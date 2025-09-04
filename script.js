// Configuración del dashboard
const config = {
    updateInterval: 5000, // Actualizar cada 5 segundos
    sensorRanges: {
        temperature: { min: 18, max: 28, optimal: 23 },
        humidity: { min: 70, max: 90, optimal: 80 },
        co2: { min: 400, max: 1200, optimal: 800 }
    },
    history: {
        maxRecords: 288,        // 24 horas × 12 registros/hora (cada 5 min)
        cleanupInterval: 3600000, // Limpiar cada hora (1 hora)
        updateInterval: 300000   // Actualizar historial cada 5 minutos
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
async function initializeDashboard() {
    updateLastUpdate();
    //generateInitialData();
    listenToFirebase();
    
    // Cargar datos históricos al inicializar
    await loadHistoricalData();
    
    updateSensorDisplays();
    updateActuatorDisplays();
}

function listenToFirebase() {
    // Verificar que Firebase esté disponible
    if (!window.db || !window.ref || !window.onValue) {
        console.error('Firebase no está inicializado correctamente');
        addAlert('Error: Firebase no está disponible', 'danger');
        return;
    }

    // Referencias a los datos en Firebase
    const sensorsRef = window.ref(window.db, 'Sensors');
    const actuatorsRef = window.ref(window.db, 'Actuators');
    
    // Escuchar cambios en los sensores
    window.onValue(sensorsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            updateSensorsFromFirebase(data);
        }
    }, (error) => {
        console.error('Error al leer sensores:', error);
        addAlert('Error al conectar con sensores', 'danger');
    });
    
    // Escuchar cambios en el historial de sensores
    const sensorsHistoryRef = window.ref(window.db, 'Sensors/history');
    window.onValue(sensorsHistoryRef, (snapshot) => {
        if (snapshot.exists()) {
            loadHistoricalDataFromSnapshot(snapshot);
        }
    }, (error) => {
        console.error('Error al leer historial de sensores:', error);
    });
    
    // Escuchar cambios en los actuadores
    window.onValue(actuatorsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            updateActuatorsFromFirebase(data);
        }
    }, (error) => {
        console.error('Error al leer actuadores:', error);
        addAlert('Error al conectar con actuadores', 'danger');
    });
    
    addAlert('Conectado a la base de datos con exito!', 'success');
    
    // Iniciar guardado automático de historial
    startHistorySaving();
}

// Función para guardar datos históricos en Firebase
async function saveSensorHistory(sensorData) {
    if (!window.db || !window.push || !window.serverTimestamp) {
        console.error('Firebase no está disponible para guardar historial');
        return;
    }

    try {
        const historyRef = window.ref(window.db, 'Sensors/history');
        await window.push(historyRef, {
            Temperature: sensorData.Temperature,
            Humidity: sensorData.Humidity,
            CO2: sensorData.CO2,
            timestamp: window.serverTimestamp()
        });
        
        console.log('Datos históricos guardados:', sensorData);
    } catch (error) {
        console.error('Error al guardar historial:', error);
    }
}

// Función para guardar historial de actuadores
async function saveActuatorHistory(actuatorData) {
    if (!window.db || !window.push || !window.serverTimestamp) {
        console.error('Firebase no está disponible para guardar historial');
        return;
    }

    try {
        const historyRef = window.ref(window.db, 'Actuators/history');
        await window.push(historyRef, {
            heating: actuatorData.heating,
            humidifier: actuatorData.humidifier,
            lighting: actuatorData.lighting,
            ventilation: actuatorData.ventilation,
            timestamp: window.serverTimestamp()
        });
        
        console.log('Historial de actuadores guardado:', actuatorData);
    } catch (error) {
        console.error('Error al guardar historial de actuadores:', error);
    }
}

// Función para limpiar historial antiguo
async function cleanupHistory() {
    if (!window.db || !window.query || !window.orderByChild || !window.limitToLast || !window.get || !window.remove) {
        console.error('Firebase no está disponible para limpiar historial');
        return;
    }

    try {
        // Limpiar historial de sensores
        const sensorsHistoryRef = window.ref(window.db, 'Sensors/history');
        const sensorsQuery = window.query(sensorsHistoryRef, window.orderByChild('timestamp'), window.limitToLast(config.history.maxRecords));
        const sensorsSnapshot = await window.get(sensorsQuery);
        
        if (sensorsSnapshot.exists()) {
            const allSensorsData = [];
            sensorsSnapshot.forEach((childSnapshot) => {
                allSensorsData.push({ key: childSnapshot.key, ...childSnapshot.val() });
            });
            
            // Ordenar por timestamp y eliminar los más antiguos
            allSensorsData.sort((a, b) => a.timestamp - b.timestamp);
            const toDelete = allSensorsData.slice(0, allSensorsData.length - config.history.maxRecords);
            
            for (const item of toDelete) {
                await window.remove(window.ref(window.db, `Sensors/history/${item.key}`));
            }
        }

        // Limpiar historial de actuadores
        const actuatorsHistoryRef = window.ref(window.db, 'Actuators/history');
        const actuatorsQuery = window.query(actuatorsHistoryRef, window.orderByChild('timestamp'), window.limitToLast(config.history.maxRecords));
        const actuatorsSnapshot = await window.get(actuatorsQuery);
        
        if (actuatorsSnapshot.exists()) {
            const allActuatorsData = [];
            actuatorsSnapshot.forEach((childSnapshot) => {
                allActuatorsData.push({ key: childSnapshot.key, ...childSnapshot.val() });
            });
            
            // Ordenar por timestamp y eliminar los más antiguos
            allActuatorsData.sort((a, b) => a.timestamp - b.timestamp);
            const toDelete = allActuatorsData.slice(0, allActuatorsData.length - config.history.maxRecords);
            
            for (const item of toDelete) {
                await window.remove(window.ref(window.db, `Actuators/history/${item.key}`));
            }
        }
        
        console.log('Limpieza de historial completada');
    } catch (error) {
        console.error('Error al limpiar historial:', error);
    }
}

// Función para iniciar el guardado automático de historial
function startHistorySaving() {
    console.log('Iniciando guardado automático de historial...');
    
    // Guardar historial cada 5 minutos (300000 ms)
    setInterval(async () => {
        console.log('Ejecutando guardado automático de historial...');
        
        try {
            // Obtener datos actuales de sensores
            const sensorsRef = window.ref(window.db, 'Sensors');
            const sensorsSnapshot = await window.get(sensorsRef);
            if (sensorsSnapshot.exists()) {
                const currentData = sensorsSnapshot.val();
                console.log('Datos actuales de sensores:', currentData);
                
                if (currentData.Temperature !== undefined && currentData.Humidity !== undefined && currentData.CO2 !== undefined) {
                    await saveSensorHistory(currentData);
                    console.log('Historial de sensores guardado exitosamente');
                } else {
                    console.log('Datos de sensores incompletos, no se guarda historial');
                }
            } else {
                console.log('No hay datos de sensores disponibles');
            }
            
            // Obtener datos actuales de actuadores
            const actuatorsRef = window.ref(window.db, 'Actuators');
            const actuatorsSnapshot = await window.get(actuatorsRef);
            if (actuatorsSnapshot.exists()) {
                const currentData = actuatorsSnapshot.val();
                console.log('Datos actuales de actuadores:', currentData);
                
                if (currentData.heating !== undefined) {
                    await saveActuatorHistory(currentData);
                    console.log('Historial de actuadores guardado exitosamente');
                } else {
                    console.log('Datos de actuadores incompletos, no se guarda historial');
                }
            } else {
                console.log('No hay datos de actuadores disponibles');
            }
        } catch (error) {
            console.error('Error en guardado automático de historial:', error);
        }
    }, config.history.updateInterval);
    
    // Limpiar historial cada hora
    setInterval(() => {
        console.log('Ejecutando limpieza de historial...');
        cleanupHistory();
    }, config.history.cleanupInterval);
    
    console.log('Guardado automático de historial configurado correctamente');
}

// Función para leer datos históricos de Firebase
async function loadHistoricalData() {
    if (!window.db || !window.query || !window.orderByChild || !window.limitToLast || !window.get) {
        console.error('Firebase no está disponible para leer historial');
        return;
    }

    try {
        // Cargar historial de sensores
        const sensorsHistoryRef = window.ref(window.db, 'Sensors/history');
        const sensorsQuery = window.query(sensorsHistoryRef, window.orderByChild('timestamp'), window.limitToLast(config.history.maxRecords));
        const sensorsSnapshot = await window.get(sensorsQuery);
        
        if (sensorsSnapshot.exists()) {
            loadHistoricalDataFromSnapshot(sensorsSnapshot);
        }
    } catch (error) {
        console.error('Error al cargar datos históricos:', error);
    }
}

// Función para procesar snapshot de datos históricos
function loadHistoricalDataFromSnapshot(snapshot) {
    // Limpiar datos históricos actuales
    historicalData.temperature = [];
    historicalData.humidity = [];
    historicalData.co2 = [];
    
    // Procesar datos históricos
    snapshot.forEach((childSnapshot) => {
        const data = childSnapshot.val();
        const timestamp = new Date(data.timestamp);
        
        historicalData.temperature.push({
            time: timestamp,
            value: data.Temperature
        });
        
        historicalData.humidity.push({
            time: timestamp,
            value: data.Humidity
        });
        
        historicalData.co2.push({
            time: timestamp,
            value: data.CO2
        });
    });
    
    // Ordenar por tiempo
    historicalData.temperature.sort((a, b) => a.time - b.time);
    historicalData.humidity.sort((a, b) => a.time - b.time);
    historicalData.co2.sort((a, b) => a.time - b.time);
    
    console.log(`Cargados ${historicalData.temperature.length} registros históricos`);
    
    // Actualizar la interfaz con datos históricos
    updateSensorDisplays();
    updateTrendCharts();
}

// Función para actualizar sensores desde Firebase
function updateSensorsFromFirebase(data) {
    const now = new Date();
    
    // Actualizar datos históricos con los nuevos valores (usando los nombres exactos de tu Firebase)
    if (data.Temperature !== undefined) {
        historicalData.temperature.push({ time: now, value: data.Temperature });
    }
    if (data.Humidity !== undefined) {
        historicalData.humidity.push({ time: now, value: data.Humidity });
    }
    if (data.CO2 !== undefined) {
        historicalData.co2.push({ time: now, value: data.CO2 });
    }
    
    // Mantener solo las últimas 24 horas (1440 puntos si se actualiza cada minuto)
    const maxPoints = 1440;
    if (historicalData.temperature.length > maxPoints) {
        historicalData.temperature.shift();
    }
    if (historicalData.humidity.length > maxPoints) {
        historicalData.humidity.shift();
    }
    if (historicalData.co2.length > maxPoints) {
        historicalData.co2.shift();
    }
    
    // Actualizar la interfaz
    updateSensorDisplays();
    updateTrendCharts();
    updateLastUpdate();
    
    // Verificar alertas
    if (data.Temperature !== undefined && data.Humidity !== undefined && data.CO2 !== undefined) {
        checkAlerts(data.Temperature, data.Humidity, data.CO2);
    }
}

// Función para actualizar actuadores desde Firebase
function updateActuatorsFromFirebase(data) {
    // Actualizar el estado local de los actuadores (usando los nombres exactos de tu Firebase)
    if (data.ventilation !== undefined) actuators.ventilation = data.ventilation;
    if (data.heating !== undefined) actuators.heating = data.heating;
    if (data.humidifier !== undefined) actuators.humidifier = data.humidifier;
    if (data.lighting !== undefined) actuators.lighting = data.lighting;
    
    // Actualizar la interfaz
    updateActuatorDisplays();
}

// Función para enviar cambios de actuadores a Firebase
function updateActuatorInFirebase(actuatorName, value) {
    if (!window.db || !window.ref || !window.set) {
        console.error('Firebase no está disponible para escribir');
        return;
    }
    
    const actuatorRef = window.ref(window.db, `Actuators/${actuatorName}`);
    window.set(actuatorRef, value)
        .then(() => {
            console.log(`${actuatorName} actualizado en Firebase:`, value);
        })
        .catch((error) => {
            console.error('Error al actualizar actuador en Firebase:', error);
            addAlert(`Error al actualizar ${actuatorName}`, 'danger');
        });
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
async function toggleActuator(actuatorName) {
    const newValue = !actuators[actuatorName];
    actuators[actuatorName] = newValue;
    updateActuatorDisplays();
    
    // Actualizar en Firebase
    updateActuatorInFirebase(actuatorName, newValue);
    
    // Guardar en historial inmediatamente
    await saveActuatorHistory(actuators);
    
    // Mostrar mensaje
    if (newValue) {
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
    
    const width = ctx.canvas.clientWidth;
    const height = ctx.canvas.clientHeight;
    ctx.canvas.width = width;
    ctx.canvas.height = height;
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
    // Solo usar simulación si Firebase no está disponible
    if (!window.db || !window.ref || !window.onValue) {
        console.log('Firebase no disponible, usando simulación de datos');
        setInterval(() => {
            simulateDataUpdate();
            updateSensorDisplays();
            updateTrendCharts();
            updateLastUpdate();
        }, config.updateInterval);
    } else {
        console.log('Firebase disponible, usando datos en tiempo real');
        // Firebase manejará las actualizaciones automáticamente
        // Solo actualizamos la última actualización periódicamente
        setInterval(() => {
            updateLastUpdate();
        }, config.updateInterval);
    }
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

// Función para probar manualmente el guardado de historial
async function testHistorySave() {
    console.log('Probando guardado manual de historial...');
    
    try {
        // Obtener datos actuales de sensores
        const sensorsRef = window.ref(window.db, 'Sensors');
        const sensorsSnapshot = await window.get(sensorsRef);
        if (sensorsSnapshot.exists()) {
            const currentData = sensorsSnapshot.val();
            console.log('Datos actuales de sensores:', currentData);
            
            if (currentData.Temperature !== undefined && currentData.Humidity !== undefined && currentData.CO2 !== undefined) {
                await saveSensorHistory(currentData);
                console.log('✅ Historial de sensores guardado manualmente');
                addAlert('Historial guardado manualmente', 'success');
            } else {
                console.log('❌ Datos de sensores incompletos');
                addAlert('Datos de sensores incompletos', 'warning');
            }
        } else {
            console.log('❌ No hay datos de sensores');
            addAlert('No hay datos de sensores', 'warning');
        }
    } catch (error) {
        console.error('❌ Error en guardado manual:', error);
        addAlert('Error al guardar historial', 'danger');
    }
}

// Agregar función de prueba al objeto window
window.testHistorySave = testHistorySave;
