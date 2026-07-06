import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../../services/api.js';

function CategoriaPage() {
    const { cuentaId } = useParams();
    return <p> Categoria Page</p>
}

export default CategoriaPage