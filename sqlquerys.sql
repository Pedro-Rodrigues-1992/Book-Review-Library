-- Create the authors table
CREATE TABLE authors (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    api_id VARCHAR(100) NOT NULL
);

-- Create the books table
CREATE TABLE books (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description VARCHAR(1500),
    review VARCHAR(5000),
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    cover_id VARCHAR(100) NOT NULL
);

-- Create the authorbooks table
CREATE TABLE authorbooks (
    id SERIAL PRIMARY KEY,
    author_id INTEGER REFERENCES authors(id),
    book_id INTEGER REFERENCES books(id)
);