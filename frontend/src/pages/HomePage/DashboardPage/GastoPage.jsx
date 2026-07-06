import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../../services/api.js';

function GastoPage() {
    const { cuentaId } = useParams();
    return <p> Gasto Page</p>
}

export default GastoPage