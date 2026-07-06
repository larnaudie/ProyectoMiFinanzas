import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../../services/api.js';

function SubcategoriaPage() {
    const { cuentaId } = useParams();
    return <p> Subcategoria Page</p>
}

export default SubcategoriaPage