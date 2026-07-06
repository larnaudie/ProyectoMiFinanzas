import { Navigate } from "react-router";

const ProtectedRoute = () => {
    const isAuth = localStorage.getItem("usuario") !== null;
    const isAdmin = localStorage.getItem("rol") === "admin";
    if(!isAuth) return <Navigate to="/login" />;
    if(!isAdmin) return <Navigate to="/" replace/>;
}

export default ProtectedRoute;