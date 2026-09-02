import app from "./app.js";

const PORT = process.env.PORT || 2000;

if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`http://localhost:${PORT}`);
    });
}

export default app;
