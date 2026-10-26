document.addEventListener('DOMContentLoaded', () => {
    const formSolicitud = document.getElementById('form-solicitud-convenio');

    if (formSolicitud) {
        formSolicitud.addEventListener('submit', async (e) => {
            e.preventDefault(); // Bloquea estrictamente que la página se recargue

            // Creamos un objeto FormData para poder adjuntar el archivo PDF
            const formData = new FormData();
            
            formData.append('razon_social', document.getElementById('razon-social').value);
            formData.append('ruc', document.getElementById('ruc').value);
            formData.append('tipo_empresa', document.getElementById('tipo-empresa').value);
            formData.append('direccion', document.getElementById('direccion').value);
            formData.append('actividad', document.getElementById('actividad').value);
            formData.append('contacto_nombre', document.getElementById('contacto-nombre').value);
            formData.append('contacto_cargo', document.getElementById('contacto-cargo').value);
            formData.append('contacto_telefono', document.getElementById('contacto-telefono').value);
            formData.append('contacto_correo', document.getElementById('contacto-correo').value);
            
            // Capturamos el archivo PDF
            const archivoPdf = document.getElementById('documento-firmado').files[0];
            formData.append('documento', archivoPdf);

            try {
                // Enviamos los datos al servidor
                const response = await fetch('http://localhost:3000/api/solicitud-convenio', {
                    method: 'POST',
                    body: formData 
                });

                const data = await response.json();

                if (data.exito) {
                    // 1. Inyectamos el código generado
                    document.getElementById('codigo-generado').textContent = data.codigo;
                    
                    // 2. Mostramos el modal
                    document.getElementById('modal-exito').style.display = 'flex';
                    
                    // 3. Limpiamos el formulario de fondo
                    formSolicitud.reset();
                    
                    // 4. Redirigimos ÚNICAMENTE cuando se hace clic en el botón
                    document.getElementById('btn-aceptar-exito').addEventListener('click', (eventoBtn) => {
                        eventoBtn.preventDefault(); // Evita cualquier recarga extra
                        window.location.href = 'index.html';
                    });
                    
                } else {
                    alert('❌ Error: ' + data.mensaje);
                }
            } catch (error) {
                console.error('Error al enviar solicitud:', error);
                alert('❌ Error de conexión con el servidor.');
            }
        });
    }
});