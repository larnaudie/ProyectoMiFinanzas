import { useDispatch } from "react-redux";
import { guardarGastos } from "../../features/slices/gastosSlice";
const dispatch = useDispatch();
const BotonEditar = (data) => {
    api.patch('/cuentas/:cuentaId/gastos/:gastoId', data)
    .then((res)=> dispatch(guardarGastos(res.data.data)))
}

export default BotonEditar;