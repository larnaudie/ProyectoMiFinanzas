import mongoose from "mongoose";
const connectDB = async () => {
    try {
console.log("MONGO_URI:", process.env.MONGO_URI);
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Conectado a MongoDB");
    } catch (error) {
        console.error("Error al conectar a MongoDB:", error);
        process.exit(1);
    }
};
export default connectDB;