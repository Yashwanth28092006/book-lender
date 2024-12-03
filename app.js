const bodyParser = require('body-parser');
const express = require('express')
const dotenv = require('dotenv');
dotenv.config();

const app = express()
const port = 3000

app.listen(port, () => {
    console.log(process.env.passwd);
    console.log(`Server running on http://localhost:${port}`);
});