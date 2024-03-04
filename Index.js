import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import password from "./cred.js";
import axios from "axios";

const app = express();
const port = 3000;

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "Library2",
  password: password,
  port: 5432,
});
db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

async function fetchImage(url) {
    try {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data, 'binary');
        return buffer.toString('base64');
    } catch (error) {
        console.error('Error fetching image:', error);
        return null;
    }
}

async function fetchBookCover(coverId, size) {
    const url = `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg`;
    return fetchImage(url);
}


async function fetchAuthorPhoto(apiId, size) {
    const url = `https://covers.openlibrary.org/a/olid/${apiId}-${size}.jpg`;
    try {
        const imageBase64 = await fetchImage(url);
        return imageBase64;
    } catch (error) {
        return null;
    }
}

async function fetchBook(title) {
    const encodedTitle = encodeURIComponent(title);
    const url = `https://openlibrary.org/search.json?q=${encodedTitle}`;
    try {
        const response = await axios.get(url);
        const data = response.data;

        if (data.docs.length > 0) {
            const bookData = data.docs[0];
            const bookTitle = bookData.title;
            const author = bookData.author_name ? bookData.author_name[0] : null;
            const coverId = bookData.cover_i ? bookData.cover_i : null;
            const authorKey = bookData.author_key ? bookData.author_key[0] : null;

            return {
                title: bookTitle,
                author: author,
                coverId: coverId,
                authorKey: authorKey
            };
        } else {
            return null;
        }
    } catch (error) {
        console.error('Error fetching book:', error);
        return null;
    }
}


app.get("/", async (req, res) => {
    try {
        const bookResult = await db.query("SELECT * FROM books ORDER BY id ASC");
        const books = bookResult.rows;

        for (const book of books) {
            const cover = await fetchBookCover(book.cover_id, 'L');
            book.coverUrl = cover ? `data:image/jpeg;base64,${cover}` : '';

            const authorResult = await db.query("SELECT authors.api_id, authors.name FROM authors INNER JOIN authorbooks ON authors.id = authorbooks.author_id WHERE authorbooks.book_id = $1", [book.id]);
            const authors = authorResult.rows.map(row => ({
                name: row.name,
                api_id: row.api_id
            }));

            book.authors = authors;

            if (authors.length > 0) {
                const author = authors[0];
                const photo = await fetchAuthorPhoto(author.api_id, 'M');
                if (photo) {
                    book.authorPhotoUrl = `data:image/jpeg;base64,${photo}`;
                }
            }
        }

        res.render("index.ejs", { books });
    } catch (err) {
        console.log(err);
        res.render("error.ejs");
    }
});


app.get("/:id/:title", async (req, res) => {
    try {
        const id = req.params.id;
        const result = await db.query("SELECT * FROM books WHERE id=$1", [id]);
        const book = result.rows[0];

        const cover = await fetchBookCover(book.cover_id, 'L');
        book.coverUrl = cover ? `data:image/jpeg;base64,${cover}` : '';

        const authorResult = await db.query("SELECT authors.name, authors.api_id FROM authors INNER JOIN authorbooks ON authors.id = authorbooks.author_id WHERE authorbooks.book_id = $1", [id]);
        const authorData = authorResult.rows.map(row => ({
            name: row.name,
            api_id: row.api_id
        }));

        book.authors = authorData;

        if (authorData.length > 0) {
            const author = authorData[0];
            const photo = await fetchAuthorPhoto(author.api_id, 'M');
            if (photo) {
                author.authorPhotoUrl = `data:image/jpeg;base64,${photo}`;
            }
        }

        res.render("book.ejs", { book });
    } catch (err) {
        console.log(err);
        res.render("error.ejs");
    }
});


app.get("/New", (req,res)=>{
    res.render("newReview.ejs")
})

app.post("/add", async (req, res) => {
    const title = req.body.title;
    const description = req.body.description;
    const review = req.body.review;
    const rating = req.body.rating;

    try {
        const bookData = await fetchBook(title);
        
        if (!bookData) {
            return res.render("error.ejs");
        }
        
        const bookTitle = bookData.title;
        const coverId = bookData.coverId; 
        const authorKey = bookData.authorKey; 
        const author = bookData.author;

        // Inserting or retrieving author ID from the database
        let authorId;
        const authorResult = await db.query("SELECT id FROM authors WHERE name=$1", [author]);
        if (authorResult.rows.length > 0) {
            authorId = authorResult.rows[0].id;
        } else {
            const newAuthorResult = await db.query("INSERT INTO authors (name, api_id) VALUES ($1, $2) RETURNING id", [author, authorKey]); 
            authorId = newAuthorResult.rows[0].id;
        }

        // Inserting book data into the database
        const bookResult = await db.query("INSERT INTO books (title, description, review, rating, cover_id) VALUES ($1, $2, $3, $4, $5) RETURNING id", [bookTitle, description, review, rating, coverId]);
        const bookId = bookResult.rows[0].id;

        // Linking author with the book in the authorbooks table
        await db.query("INSERT INTO authorbooks (author_id, book_id) VALUES ($1, $2)", [authorId, bookId]);

        res.redirect("/");
    } catch (err) {
        console.log(err);
        res.render("error.ejs");
    }
});

app.get("/update/:id/:title", async (req, res) => {
    try {
        const id = req.params.id;
        const result = await db.query("SELECT * FROM books WHERE id=$1", [id]);
        const book = result.rows[0];

        res.render("update.ejs", { book });
    } catch (err) {
        console.log(err);
        res.render("error.ejs");
    }
});

app.post("/update/:id/:title", async (req, res) => {
    
    try {
        const id = req.params.id;
        const putTitle = req.body.bookTitle;
        const putDescription = req.body.bookDescription;
        const putReview = req.body.bookReview;
        const putRating = req.body.bookRating;

        await db.query("UPDATE books SET title = $1, description = $2, review = $3, rating = $4 WHERE id = $5", [putTitle, putDescription, putReview, putRating, id]);

        res.redirect(`/${id}/${putTitle}`);
    } catch (err) {
        console.log(err);   
        res.render("error.ejs");
    }
});

app.delete("/delete/:id", async (req, res) => {
    const bookId = req.params.id;
    try {
        const authorBookResult = await db.query("SELECT * FROM authorbooks WHERE book_id = $1", [bookId]);
        const authorBooks = authorBookResult.rows;

        for (const authorBook of authorBooks) {
            await db.query("DELETE FROM authorbooks WHERE id = $1", [authorBook.id]);
        }

        await db.query("DELETE FROM books WHERE id = $1", [bookId]);
        
        res.sendStatus(200);
        // res.redirect("/");
    } catch (err) {
        console.log(err);
        res.status(500).send("Failed to delete the review.");
    }
});



app.get("/about", (req, res)=>{
    res.render("about.ejs")
})

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});