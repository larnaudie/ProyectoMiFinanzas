import { useLocation, useNavigate } from "react-router-dom";

function BackNavigationButton() {
  const location = useLocation();
  const navigate = useNavigate();

  const volver = () => {
    if (location.key === "default") {
      navigate("/home", { replace: true });
      return;
    }

    navigate(-1);
  };

  return (
    <nav className="page-back-navigation" aria-label="Navegación de la página">
      <button
        type="button"
        className="page-back-button"
        onClick={volver}
        aria-label="Volver a la página anterior"
        title="Volver"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
    </nav>
  );
}

export default BackNavigationButton;
