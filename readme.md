# 🍄 Dashboard de Monitoreo - Cultivo de Hongos

Un dashboard web moderno y responsivo para monitorear las condiciones ambientales de un cultivo de hongos en tiempo real.

## ✨ Características

### 📊 Monitoreo de Sensores
- **Temperatura**: Monitoreo en tiempo real con rangos óptimos (18-28°C)
- **Humedad Relativa**: Control de humedad (70-90%)
- **CO2**: Monitoreo de niveles de dióxido de carbono (400-1200 ppm)
- **Mini gráficos**: Visualización de tendencias recientes
- **Estados**: Indicadores visuales de normalidad, bajo o alto

### 🎛️ Control de Actuadores
- **Ventilación**: Control de circulación de aire
- **Calefacción**: Sistema de calefacción
- **Humidificador**: Control de humedad ambiental
- **Iluminación**: Sistema de iluminación
- **Control manual**: Botones para activar/desactivar cada actuador

### 📈 Gráficos de Tendencias
- **Gráficos de 24 horas**: Visualización de datos históricos
- **Actualización automática**: Datos se actualizan cada 5 segundos
- **Canvas nativo**: Gráficos dibujados con HTML5 Canvas

### 🚨 Sistema de Alertas
- **Alertas automáticas**: Notificaciones cuando los valores están fuera de rango
- **Tipos de alerta**: Info, Warning, Danger, Success
- **Auto-eliminación**: Las alertas se eliminan automáticamente después de 10 segundos

## 🚀 Instalación y Uso

### Requisitos
- Navegador web moderno (Chrome, Firefox, Safari, Edge)
- No requiere servidor web - funciona localmente

### Pasos de Instalación
1. Descarga todos los archivos en una carpeta
2. Abre `index.html` en tu navegador web
3. ¡Listo! El dashboard comenzará a funcionar automáticamente

### Estructura de Archivos
```
FunGuys-LiveDemo/
├── index.html          # Página principal del dashboard
├── styles.css          # Estilos CSS del dashboard
├── script.js           # Funcionalidad JavaScript
└── README.md           # Este archivo
```

## 🎯 Funcionalidades Principales

### Simulación de Datos
- El dashboard simula datos reales de sensores
- Los valores cambian cada 5 segundos
- Los actuadores afectan los valores de los sensores

### Interactividad
- **Control de actuadores**: Haz clic en los botones para activar/desactivar
- **Alertas en tiempo real**: Observa cómo se generan alertas automáticamente
- **Gráficos dinámicos**: Los gráficos se actualizan automáticamente

### Responsividad
- Diseño adaptativo para dispositivos móviles
- Interfaz optimizada para tablets y smartphones
- Grid system flexible que se adapta a diferentes tamaños de pantalla

## 🔧 Personalización

### Modificar Rangos de Sensores
En `script.js`, puedes ajustar los rangos óptimos:

```javascript
const config = {
    sensorRanges: {
        temperature: { min: 18, max: 28, optimal: 23 },
        humidity: { min: 70, max: 90, optimal: 80 },
        co2: { min: 400, max: 1200, optimal: 800 }
    }
};
```

### Cambiar Intervalo de Actualización
```javascript
const config = {
    updateInterval: 5000, // Cambiar a 10000 para actualizar cada 10 segundos
    // ... resto de configuración
};
```

### Agregar Nuevos Sensores
1. Agregar el HTML en `index.html`
2. Agregar estilos en `styles.css`
3. Agregar lógica en `script.js`

## �� Tecnologías Utilizadas

- **HTML5**: Estructura semántica moderna
- **CSS3**: 
  - Grid y Flexbox para layouts
  - Gradientes y sombras para diseño moderno
  - Media queries para responsividad
  - Animaciones y transiciones
- **JavaScript ES6+**:
  - Canvas API para gráficos
  - Promesas y async/await
  - Manipulación del DOM
  - Simulación de datos en tiempo real

## 📱 Compatibilidad

- **Navegadores**: Chrome 60+, Firefox 55+, Safari 12+, Edge 79+
- **Dispositivos**: Desktop, Tablet, Mobile
- **Resoluciones**: 320px - 1920px+

## 🔮 Próximas Mejoras

- [ ] Integración con sensores reales via API
- [ ] Base de datos para almacenamiento histórico
- [ ] Notificaciones push
- [ ] Modo oscuro
- [ ] Exportación de datos en diferentes formatos
- [ ] Dashboard administrativo
- [ ] Sistema de usuarios y permisos

## 🤝 Contribuciones

¡Las contribuciones son bienvenidas! Si tienes ideas para mejorar el dashboard:

1. Fork el proyecto
2. Crea una rama para tu feature
3. Commit tus cambios
4. Push a la rama
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

## 📞 Soporte

Si tienes preguntas o problemas:
- Abre un issue en GitHub
- Contacta al equipo de desarrollo
- Consulta la documentación

---

**¡Disfruta monitoreando tu cultivo de hongos! 🍄✨**