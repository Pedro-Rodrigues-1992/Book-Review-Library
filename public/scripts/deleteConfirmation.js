function confirmDelete(id) {
    console.log('Delete button clicked for id:', id);
    if (confirm("Are you sure you want to delete this review?")) {
        console.log('User confirmed deletion');
        fetch(`/delete/${id}`, { method: 'DELETE' })
            .then(response => {
                if (response.ok) {
                    window.location.href = "/";
                } else {
                    alert("Failed to delete review.");
                }               
            })
            .catch(error => {
                console.error('Error:', error);
            });
    }
}