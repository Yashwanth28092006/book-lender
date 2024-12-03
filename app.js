const { PGHOST, PGDATABASE, PGUSER, PGPASSWORD } = process.env;
const bodyParser = require('body-parser');
const express = require('express')
const { Pool } = require('pg')
const dotenv = require('dotenv');
dotenv.config();

// Setting application
var current = 2
const app = express()
// app.use(cors())
app.use(express.json())
const port = 3000

// Initialising Pool
const pool = new Pool({
    host: PGHOST,
    database: PGDATABASE,
    username: PGUSER,
    password: PGPASSWORD,
    port: 5432,
    ssl: {
        require: true,
    }
})

// Routes

// 1. Add a New Book
app.post('/books', async (req, res) => {
    const { title, author, isbn, availability } = req.body;

    if (!title || !author || !isbn) {
        return res.status(400).json({ message: 'Title, author, and ISBN are required.' });
    }

    const query = `
        INSERT INTO books (title, author, isbn, availability, added_at)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP) RETURNING id;
    `;

    const values = [title, author, isbn, availability];

    try {
        const result = await pool.query(query, values);
        res.status(201).json({ message: 'Book added successfully', bookId: result.rows[0].id });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error adding the book.' });
    }
});

// 2. Add a new user
app.post('/users', async (req, res) => {
    const { name, email, membership_type } = req.body;

    if (!name || !email || !membership_type) {
        return res.status(400).json({ message: 'Name, email, and membership type are required.' });
    }

    const query = `
        INSERT INTO users (name, email, membership_type, created_at)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP) RETURNING id;
    `;
    const values = [name, email, membership_type];

    try {
        const result = await pool.query(query, values);
        res.status(201).json({ message: 'User registered successfully', userId: result.rows[0].id });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error registering the user.' });
    }
});

// 3. Borrow a Book
app.put('/books/:id/borrow', async (req, res) => {
    const bookId = req.params.id;
    const { user_id } = req.body;

    if (!user_id) {
        return res.status(400).json({ message: 'User ID is required.' });
    }

    const checkAvailabilityQuery = `SELECT availability FROM books WHERE id = $1`;
    const borrowQuery = `
        INSERT INTO transactions (user_id, book_id, borrowed_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP) RETURNING id;
    `;
    const updateBookQuery = `UPDATE books SET availability = false WHERE id = $1 RETURNING id`;

    try {
        // Check if the book is available
        const book = await pool.query(checkAvailabilityQuery, [bookId]);

        if (!book.rows.length || !book.rows[0].availability) {
            return res.status(400).json({ message: 'Book is not available for borrowing.' });
        }

        // Create the borrow transaction
        const transactionResult = await pool.query(borrowQuery, [user_id, bookId]);

        // Update book availability to false (borrowed)
        await pool.query(updateBookQuery, [bookId]);

        res.status(200).json({ message: 'Book borrowed successfully', transactionId: transactionResult.rows[0].id });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error borrowing the book.' });
    }
});

// 4. Return a Book
app.put('/books/:id/return', async (req, res) => {
    const bookId = req.params.id;
    const { user_id } = req.body;

    if (!user_id) {
        return res.status(400).json({ message: 'User ID is required.' });
    }

    const checkTransactionQuery = `
        SELECT id FROM transactions
        WHERE user_id = $1 AND book_id = $2 AND returned_at IS NULL
        ORDER BY borrowed_at DESC LIMIT 1
    `;
    const updateTransactionQuery = `
        UPDATE transactions
        SET returned_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING id;
    `;
    const updateBookQuery = `UPDATE books SET availability = true WHERE id = $1 RETURNING id`;

    try {
        // Check if there's an active transaction for the book (not returned yet)
        const transactionResult = await pool.query(checkTransactionQuery, [user_id, bookId]);

        if (!transactionResult.rows.length) {
            return res.status(400).json({ message: 'No active borrow transaction found for this book.' });
        }

        const transactionId = transactionResult.rows[0].id;

        // Update the transaction to set returned_at timestamp
        await pool.query(updateTransactionQuery, [transactionId]);

        // Update the book's availability to true (returned)
        await pool.query(updateBookQuery, [bookId]);

        res.status(200).json({ message: 'Book returned successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error returning the book.' });
    }
});

// 5. Fetch Borrowing History
app.get('/users/:id/transactions', async (req, res) => {
    const userId = req.params.id;

    const query = `
        SELECT books.title, books.author, transactions.borrowed_at, transactions.returned_at
        FROM transactions
        JOIN books ON books.id = transactions.book_id
        WHERE transactions.user_id = $1
        ORDER BY transactions.borrowed_at DESC;
    `;

    try {
        const result = await pool.query(query, [userId]);
        res.status(200).json({ transactions: result.rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching transactions.' });
    }
});




// Running server
app.listen(port, async () => {
    const client = await pool.connect();
    try {
        const res = await client.query("SELECT * FROM books");
        console.log(res.rows)
        console.log("~~Database connection is successful~~");
    } catch (error) {
        console.log(error, "\n~~Database connection is unsuccessful~~");
    } finally {
        client.release();
    }
    console.log(`Server running on http://localhost:${port}`);
});