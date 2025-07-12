import express from 'express';
import bodyParser from 'body-parser'
import { v1 } from '#api/v1/index.mjs';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use('/v1', v1)

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
