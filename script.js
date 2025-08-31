// Configuración del dashboard
const config = {
    updateInterval: 5000, // Actualizar cada 5 segundos
    sensorRanges: {
        temperature: { min: 18, max: 28, optimal: 23 },
        humidity: { min: 70, max: 90, optimal: 80 },
        co2: { min: 400, max: 1200, optimal: 800 }
    }
};

// Estado de los actuadores
let actuators = {
    ventilation: false,
    heating: false,
    humidifier: false,
    lighting: false
};

// Datos históricos para gráficos
let historicalData = {
    temperature: [],
    humidity: [],
    co2: []
};

// Inicialización del dashboard
document.addEventListener('DOMContentLoaded', function() {
    initializeDashboard();
    startDataUpdates();
    initializeCharts();
});

// Función de inicialización
function initializeDashboard() {
    updateLastUpdate();
    generateInitialData();
    updateSensorDisplays();
    updateActuatorDisplays();
}

// Función para generar datos iniciales simulados
function generateInitialData() {
    const now = new Date();
    
    // Generar datos para las últimas 24 horas
    for (let i = 23; i >= 0; i--) {
        const time = new Date(now.getTime() - i * 60 * 60 * 1000);
        
        historicalData.temperature.push({
            time: time,
            value: 20 + Math.random() * 8 + Math.sin(i / 24 * Math.PI) * 3
        });
        
        historicalData.humidity.push({
            time: time,
            value: 75 + Math.random() * 15 + Math.sin(i / 24 * Math.PI) * 5
        });
        
        historicalData.co2.push({
            time: time,
            value: 600 + Math.random() * 400 + Math.sin(i / 24 * Math.PI) * 200
        });
    }
}

// Función para actualizar la última actualización
function updateLastUpdate() {
    const now = new Date();
    document.getElementById('lastUpdate').textContent = now.toLocaleString('es-ES');
}

// Función para actualizar las pantallas de sensores
function updateSensorDisplays() {
    // Obtener valores actuales
    const currentTemp = historicalData.temperature[historicalData.temperature.length - 1]?.value || 23;
    const currentHum = historicalData.humidity[historicalData.humidity.length - 1]?.value || 80;
    const currentCO2 = historicalData.co2[historicalData.co2.length - 1]?.value || 800;
    
    // Actualizar valores
    document.getElementById('temperature').textContent = `${currentTemp.toFixed(1)}°C`;
    document.getElementById('humidity').textContent = `${currentHum.toFixed(1)}%`;
    document.getElementById('co2').textContent = `${currentCO2.toFixed(0)} ppm`;
    
    // Actualizar estados
    updateSensorStatus('tempStatus', currentTemp, config.sensorRanges.temperature);
    updateSensorStatus('humStatus', currentHum, config.sensorRanges.humidity);
    updateSensorStatus('co2Status', currentCO2, config.sensorRanges.co2);
    
    // Actualizar mini gráficos
    updateMiniCharts();
}

// Función para actualizar el estado de los sensores
function updateSensorStatus(elementId, value, range) {
    const element = document.getElementById(elementId);
    let status, className;
    
    if (value < range.min) {
        status = 'Bajo';
        className = 'alert-warning';
    } else if (value > range.max) {
        status = 'Alto';
        className = 'alert-danger';
    } else {
        status = 'Normal';
        className = 'alert-success';
    }
    
    element.textContent = status;
    element.className = `sensor-status ${className}`;
}

// Función para actualizar mini gráficos
function updateMiniCharts() {
    const tempCtx = document.getElementById('tempChart').getContext('2d');
    const humCtx = document.getElementById('humChart').getContext('2d');
    const co2Ctx = document.getElementById('co2Chart').getContext('2d');
    
    // Limpiar canvas
    tempCtx.clearRect(0, 0, 100, 60);
    humCtx.clearRect(0, 0, 100, 60);
    co2Ctx.clearRect(0, 0, 100, 60);
    
    // Dibujar mini gráficos
    drawMiniChart(tempCtx, historicalData.temperature.slice(-10), '#ff6b6b');
    drawMiniChart(humCtx, historicalData.humidity.slice(-10), '#74b9ff');
    drawMiniChart(co2Ctx, historicalData.co2.slice(-10), '#55a3ff');
}

// Función para dibujar mini gráficos
function drawMiniChart(ctx, data, color) {
    if (data.length < 2) return;
    
    const width = 100;
    const height = 60;
    const padding = 10;
    
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    data.forEach((point, index) => {
        const x = padding + (index / (data.length - 1)) * (width - 2 * padding);
        const y = height - padding - (point.value / 100) * (height - 2 * padding);
        
        if (index === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });
    
    ctx.stroke();
}

// Función para actualizar las pantallas de actuadores
function updateActuatorDisplays() {
    Object.keys(actuators).forEach(actuator => {
        const card = document.getElementById(`${actuator}Card`);
        const statusElement = document.getElementById(`${actuator}Status`);
        
        if (actuators[actuator]) {
            card.classList.add('active');
            statusElement.textContent = 'Activado';
            statusElement.style.color = '#27ae60';
        } else {
            card.classList.remove('active');
            statusElement.textContent = 'Desactivado';
            statusElement.style.color = '#7f8c8d';
        }
    });
}

// Función para alternar actuadores
function toggleActuator(actuatorName) {
    actuators[actuatorName] = !actuators[actuatorName];
    updateActuatorDisplays();
    
    // Simular efecto en los sensores
    if (actuators[actuatorName]) {
        addAlert(`Actuador ${actuatorName} activado`, 'success');
    } else {
        addAlert(`Actuador ${actuatorName} desactivado`, 'info');
    }
}

// Función para agregar alertas
function addAlert(message, type = 'info') {
    const alertsContainer = document.getElementById('alertsContainer');
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    
    let icon = 'info-circle';
    if (type === 'warning') icon = 'exclamation-triangle';
    if (type === 'danger') icon = 'times-circle';
    if (type === 'success') icon = 'check-circle';
    
    alertDiv.innerHTML = `
        <i class="fas fa-${icon}"></i>
        <span>${message}</span>
    `;
    
    alertsContainer.insertBefore(alertDiv, alertsContainer.firstChild);
    
    // Limitar a 5 alertas
    while (alertsContainer.children.length > 5) {
        alertsContainer.removeChild(alertsContainer.lastChild);
    }
    
    // Auto-remover después de 10 segundos
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.parentNode.removeChild(alertDiv);
        }
    }, 10000);
}

// Función para inicializar gráficos de tendencias
function initializeCharts() {
    updateTrendCharts();
}

// Función para actualizar gráficos de tendencias
function updateTrendCharts() {
    const tempCtx = document.getElementById('tempTrendChart').getContext('2d');
    const humCtx = document.getElementById('humTrendChart').getContext('2d');
    
    // Limpiar canvas
    tempCtx.clearRect(0, 0, 400, 200);
    humCtx.clearRect(0, 0, 400, 200);
    
    // Dibujar gráficos de tendencias
    drawTrendChart(tempCtx, historicalData.temperature, 'Temperatura (°C)', '#ff6b6b');
    drawTrendChart(humCtx, historicalData.humidity, 'Humedad (%)', '#74b9ff');
}

// Función para dibujar gráficos de tendencias
function drawTrendChart(ctx, data, label, color) {
    if (data.length < 2) return;
    
    const width = 400;
    const height = 200;
    const padding = 40;
    
    // Encontrar valores min y max
    const values = data.map(d => d.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const valueRange = maxValue - minValue;
    
    // Dibujar ejes
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1;
    
    // Eje Y
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.stroke();
    
    // Eje X
    ctx.beginPath();
    ctx.moveTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();
    
    // Dibujar línea de datos
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    
    data.forEach((point, index) => {
        const x = padding + (index / (data.length - 1)) * (width - 2 * padding);
        const y = height - padding - ((point.value - minValue) / valueRange) * (height - 2 * padding);
        
        if (index === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });
    
    ctx.stroke();
    
    // Dibujar puntos
    ctx.fillStyle = color;
    data.forEach((point, index) => {
        const x = padding + (index / (data.length - 1)) * (width - 2 * padding);
        const y = height - padding - ((point.value - minValue) / valueRange) * (height - 2 * padding);
        
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, 2 * Math.PI);
        ctx.fill();
    });
    
    // Etiquetas
    ctx.fillStyle = '#333';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    
    // Etiqueta X
    ctx.fillText('Tiempo (24h)', width / 2, height - 10);
    
    // Etiqueta Y
    ctx.save();
    ctx.translate(20, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(label, 0, 0);
    ctx.restore();
}

// Función para simular actualizaciones de datos
function simulateDataUpdate() {
    const now = new Date();
    
    // Generar nuevos valores con variación realista
    const lastTemp = historicalData.temperature[historicalData.temperature.length - 1]?.value || 23;
    const lastHum = historicalData.humidity[historicalData.humidity.length - 1]?.value || 80;
    const lastCO2 = historicalData.co2[historicalData.co2.length - 1]?.value || 800;
    
    // Simular efectos de actuadores
    let newTemp = lastTemp + (Math.random() - 0.5) * 2;
    let newHum = lastHum + (Math.random() - 0.5) * 3;
    let newCO2 = lastCO2 + (Math.random() - 0.5) * 50;
    
    if (actuators.heating) newTemp += 0.5;
    if (actuators.humidifier) newHum += 2;
    if (actuators.ventilation) newCO2 -= 30;
    
    // Mantener valores dentro de rangos realistas
    newTemp = Math.max(15, Math.min(35, newTemp));
    newHum = Math.max(50, Math.min(95, newHum));
    newCO2 = Math.max(300, Math.min(2000, newCO2));
    
    // Agregar nuevos datos
    historicalData.temperature.push({ time: now, value: newTemp });
    historicalData.humidity.push({ time: now, value: newHum });
    historicalData.co2.push({ time: now, value: newCO2 });
    
    // Mantener solo las últimas 24 horas
    if (historicalData.temperature.length > 24) {
        historicalData.temperature.shift();
        historicalData.humidity.shift();
        historicalData.co2.shift();
    }
    
    // Verificar alertas
    checkAlerts(newTemp, newHum, newCO2);
}

// Función para verificar alertas
function checkAlerts(temp, hum, co2) {
    if (temp < config.sensorRanges.temperature.min) {
        addAlert(`Temperatura baja: ${temp.toFixed(1)}°C`, 'warning');
    } else if (temp > config.sensorRanges.temperature.max) {
        addAlert(`Temperatura alta: ${temp.toFixed(1)}°C`, 'danger');
    }
    
    if (hum < config.sensorRanges.humidity.min) {
        addAlert(`Humedad baja: ${hum.toFixed(1)}%`, 'warning');
    } else if (hum > config.sensorRanges.humidity.max) {
        addAlert(`Humedad alta: ${hum.toFixed(1)}%`, 'danger');
    }
    
    if (co2 > config.sensorRanges.co2.max) {
        addAlert(`Nivel de CO2 alto: ${co2.toFixed(0)} ppm`, 'danger');
    }
}

// Función para iniciar actualizaciones de datos
function startDataUpdates() {
    setInterval(() => {
        simulateDataUpdate();
        updateSensorDisplays();
        updateTrendCharts();
        updateLastUpdate();
    }, config.updateInterval);
}

// Función para exportar datos (opcional)
function exportData() {
    const dataStr = JSON.stringify(historicalData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `datos_hongos_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
}

// Agregar función de exportación al objeto window para uso global
window.exportData = exportData;
