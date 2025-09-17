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

// Estado de autenticación
let isAdmin = false;
let authUser = null;

// Estado del modo de control
let isAutoMode = true;

// Rangos de control actuales
let controlRanges = {
    tempMin: 23.0,
    tempMax: 28.0,
    humMin: 80.0,
    humMax: 90.0,
    humExtractorMin: 90.0
};

// Programación de luces actual
let lightSchedule = {
    mode: 'manual', // 'manual', 'schedule', 'cycle'
    schedule: {
        startHour: 8,
        startMin: 0,
        endHour: 20,
        endMin: 0
    },
    cycle: {
        onHours: 12,
        offHours: 12
    }
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
    
    // Cargar datos actuales de sensores inmediatamente
    await loadCurrentSensorData();
    
    // Cargar datos actuales de actuadores inmediatamente
    await loadCurrentActuatorData();
    
    // Cargar rangos desde Firebase
    await loadRangesFromFirebase();
    
    // Cargar programación de luces desde Firebase
    await loadLightScheduleFromFirebase();
    
    updateSensorDisplays();
    updateActuatorDisplays();
    
    // Inicializar UI de admin
    updateAdminUI();
    
    // Inicializar UI de modo de control
    updateModeUI();
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
    
    // Escuchar cambios en los rangos
    const rangesRef = window.ref(window.db, 'Ranges');
    window.onValue(rangesRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            updateRangesFromFirebase(data);
        }
    }, (error) => {
        console.error('Error al leer rangos:', error);
    });
    
    // Escuchar cambios en la programación de luces
    const lightScheduleRef = window.ref(window.db, 'LightSchedule');
    window.onValue(lightScheduleRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            updateLightScheduleFromFirebase(data);
        }
    }, (error) => {
        console.error('Error al leer programación de luces:', error);
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

// Función para cargar datos actuales de sensores
async function loadCurrentSensorData() {
    if (!window.db || !window.ref || !window.get) {
        console.error('Firebase no está disponible para leer datos actuales');
        return;
    }

    try {
        // Cargar datos actuales de sensores
        const sensorsRef = window.ref(window.db, 'Sensors');
        const sensorsSnapshot = await window.get(sensorsRef);
        
        if (sensorsSnapshot.exists()) {
            const currentData = sensorsSnapshot.val();
            console.log('Datos actuales de sensores cargados:', currentData);
            
            // Actualizar datos históricos con los valores actuales
            const now = new Date();
            if (currentData.Temperature !== undefined) {
                historicalData.temperature.push({ time: now, value: currentData.Temperature });
            }
            if (currentData.Humidity !== undefined) {
                historicalData.humidity.push({ time: now, value: currentData.Humidity });
            }
            if (currentData.CO2 !== undefined) {
                historicalData.co2.push({ time: now, value: currentData.CO2 });
            }
            
            console.log('Datos actuales agregados al historial');
        } else {
            console.log('No hay datos actuales de sensores disponibles');
        }
    } catch (error) {
        console.error('Error al cargar datos actuales de sensores:', error);
    }
}

// Función para cargar datos actuales de actuadores
async function loadCurrentActuatorData() {
    if (!window.db || !window.ref || !window.get) {
        console.error('Firebase no está disponible para leer datos actuales de actuadores');
        return;
    }

    try {
        // Cargar datos actuales de actuadores
        const actuatorsRef = window.ref(window.db, 'Actuators');
        const actuatorsSnapshot = await window.get(actuatorsRef);
        
        if (actuatorsSnapshot.exists()) {
            const currentData = actuatorsSnapshot.val();
            console.log('Datos actuales de actuadores cargados:', currentData);
            
            // Actualizar estado local de actuadores
            if (currentData.ventilation !== undefined) actuators.ventilation = currentData.ventilation;
            if (currentData.heating !== undefined) actuators.heating = currentData.heating;
            if (currentData.humidifier !== undefined) actuators.humidifier = currentData.humidifier;
            if (currentData.lighting !== undefined) actuators.lighting = currentData.lighting;
            
            console.log('Estado de actuadores actualizado:', actuators);
        } else {
            console.log('No hay datos actuales de actuadores disponibles');
        }
    } catch (error) {
        console.error('Error al cargar datos actuales de actuadores:', error);
    }
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
    // Solo limpiar si no hay datos actuales cargados
    if (historicalData.temperature.length === 0) {
        historicalData.temperature = [];
        historicalData.humidity = [];
        historicalData.co2 = [];
    }
    
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
    
    console.log('Datos de sensores actualizados desde Firebase:', {
        Temperature: data.Temperature,
        Humidity: data.Humidity,
        CO2: data.CO2
    });
}

// Función para actualizar actuadores desde Firebase
function updateActuatorsFromFirebase(data) {
    // Actualizar el estado local de los actuadores (usando los nombres exactos de tu Firebase)
    if (data.ventilation !== undefined) actuators.ventilation = data.ventilation;
    if (data.heating !== undefined) actuators.heating = data.heating;
    if (data.humidifier !== undefined) actuators.humidifier = data.humidifier;
    if (data.lighting !== undefined) actuators.lighting = data.lighting;
    
    // Actualizar modo automático
    if (data.auto !== undefined) {
        isAutoMode = data.auto;
        updateModeUI();
    }
    
    // Actualizar la interfaz
    updateActuatorDisplays();
}

// Función para actualizar rangos desde Firebase
function updateRangesFromFirebase(data) {
    if (data.tempMin !== undefined) controlRanges.tempMin = data.tempMin;
    if (data.tempMax !== undefined) controlRanges.tempMax = data.tempMax;
    if (data.humMin !== undefined) controlRanges.humMin = data.humMin;
    if (data.humMax !== undefined) controlRanges.humMax = data.humMax;
    if (data.humExtractorMin !== undefined) controlRanges.humExtractorMin = data.humExtractorMin;
    
    console.log('Rangos actualizados desde Firebase:', controlRanges);
    
    // Actualizar UI de rangos si el modal está abierto
    updateRangesUI();
}

// Función para cargar rangos desde Firebase
async function loadRangesFromFirebase() {
    if (!window.db || !window.ref || !window.get) {
        console.error('Firebase no está disponible para leer rangos');
        return;
    }

    try {
        const rangesRef = window.ref(window.db, 'Ranges');
        const snapshot = await window.get(rangesRef);
        
        if (snapshot.exists()) {
            const data = snapshot.val();
            updateRangesFromFirebase(data);
            console.log('Rangos cargados desde Firebase:', data);
        } else {
            console.log('No hay rangos en Firebase, usando valores por defecto');
            // Enviar rangos por defecto a Firebase
            await sendRangesToFirebase();
        }
    } catch (error) {
        console.error('Error al cargar rangos desde Firebase:', error);
    }
}

// Función para enviar rangos a Firebase
async function sendRangesToFirebase() {
    if (!window.db || !window.ref || !window.set) {
        console.error('Firebase no está disponible para escribir rangos');
        return;
    }
    
    try {
        const rangesRef = window.ref(window.db, 'Ranges');
        await window.set(rangesRef, {
            tempMin: controlRanges.tempMin,
            tempMax: controlRanges.tempMax,
            humMin: controlRanges.humMin,
            humMax: controlRanges.humMax,
            humExtractorMin: controlRanges.humExtractorMin
        });
        
        console.log('Rangos enviados a Firebase:', controlRanges);
        addAlert('Rangos actualizados correctamente', 'success');
    } catch (error) {
        console.error('Error al enviar rangos a Firebase:', error);
        addAlert('Error al actualizar rangos', 'danger');
    }
}

// Función para enviar modo automático a Firebase
async function sendAutoModeToFirebase(autoMode) {
    if (!window.db || !window.ref || !window.set) {
        console.error('Firebase no está disponible para escribir modo');
        return;
    }
    
    try {
        const modeRef = window.ref(window.db, 'Actuators/auto');
        await window.set(modeRef, autoMode);
        
        console.log('Modo automático enviado a Firebase:', autoMode);
        addAlert(`Modo ${autoMode ? 'automático' : 'manual'} activado`, 'success');
    } catch (error) {
        console.error('Error al enviar modo a Firebase:', error);
        addAlert('Error al cambiar modo de control', 'danger');
    }
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
    // Obtener valores actuales de los datos históricos o usar valores por defecto
    let currentTemp = historicalData.temperature[historicalData.temperature.length - 1]?.value;
    let currentHum = historicalData.humidity[historicalData.humidity.length - 1]?.value;
    let currentCO2 = historicalData.co2[historicalData.co2.length - 1]?.value;
    
    // Si no hay datos históricos, intentar obtener datos actuales de Firebase
    if (currentTemp === undefined || currentHum === undefined || currentCO2 === undefined) {
        // Usar valores por defecto solo si no hay datos disponibles
        currentTemp = currentTemp || 23;
        currentHum = currentHum || 80;
        currentCO2 = currentCO2 || 800;
    }
    
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
        const button = card.querySelector('button');
        
        if (actuators[actuator]) {
            card.classList.add('active');
            statusElement.textContent = 'Activado';
            statusElement.style.color = '#27ae60';
        } else {
            card.classList.remove('active');
            statusElement.textContent = 'Desactivado';
            statusElement.style.color = '#7f8c8d';
        }
        
        // Deshabilitar controles en modo automático o si no es admin
        if (isAutoMode || !isAdmin) {
            card.classList.add('disabled');
            if (button) {
                button.disabled = true;
                if (isAutoMode) {
                    button.title = 'Controles deshabilitados en modo automático';
                } else {
                    button.title = 'Requiere modo administrador';
                }
            }
        } else {
            card.classList.remove('disabled');
            if (button) {
                button.disabled = false;
                button.title = 'Activar/Desactivar';
            }
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

// ===== SISTEMA DE LOGIN =====

// Función para alternar modo administrador
function toggleAdminMode() {
    if (isAdmin) {
        // Si ya es admin, desactivar modo admin
        isAdmin = false;
        updateAdminUI();
        addAlert('Modo administrador desactivado', 'info');
    } else {
        // Si no es admin, mostrar modal de login
        showLoginModal();
    }
}

// Función para mostrar modal de login
function showLoginModal() {
    const modal = document.getElementById('loginModal');
    const passwordInput = document.getElementById('passwordInput');
    const errorDiv = document.getElementById('loginError');
    
    // Limpiar campos
    passwordInput.value = '';
    errorDiv.style.display = 'none';
    
    // Mostrar modal
    modal.style.display = 'block';
    
    // Enfocar input de contraseña
    setTimeout(() => {
        passwordInput.focus();
    }, 100);
}

// Función para cerrar modal de login
function closeLoginModal() {
    const modal = document.getElementById('loginModal');
    modal.style.display = 'none';
}

// Función para verificar contraseña
async function checkPassword() {
    const passwordInput = document.getElementById('passwordInput');
    const errorDiv = document.getElementById('loginError');
    const password = passwordInput.value.trim();
    const emailInput = document.getElementById('emailInput');
    const email = emailInput.value.trim();
    
    const auth = window.getAuth(window.app);
    try {
        const userCredential = await window.signInWithEmailAndPassword(auth, email, password);
        authUser = userCredential.user;
        isAdmin = true;
        updateAdminUI();
        closeLoginModal();
        addAlert('Modo administrador activado', 'success');
    } catch (error) {
        errorDiv.style.display = 'block';
        passwordInput.value = '';
        passwordInput.focus();
        errorDiv.querySelector('span').textContent = 'Error de autenticación. Verifica tus credenciales.';
        const modalContent = document.querySelector('.modal-content');
        modalContent.style.animation = 'shake 0.5s ease-in-out';
        setTimeout(() => {
            modalContent.style.animation = '';
        }, 500);
    }
    
    
    
    // if (password === ADMIN_PASSWORD) {
    //     // Contraseña correcta
    //     isAdmin = true;
    //     updateAdminUI();
    //     closeLoginModal();
    //     addAlert('Modo administrador activado', 'success');
    // } else {
    //     // Contraseña incorrecta
    //     errorDiv.style.display = 'block';
    //     passwordInput.value = '';
    //     passwordInput.focus();
        
    //     // Agregar efecto de shake al modal
    //     const modalContent = document.querySelector('.modal-content');
    //     modalContent.style.animation = 'shake 0.5s ease-in-out';
    //     setTimeout(() => {
    //         modalContent.style.animation = '';
    //     }, 500);
    // }
}

// Función para actualizar la UI según el estado de admin
function updateAdminUI() {
    const adminToggle = document.getElementById('adminToggle');
    const actuatorCards = document.querySelectorAll('.actuator-card');
    
    if (isAdmin) {
        // Modo admin activado
        adminToggle.textContent = '🔓 Modo Administrador';
        adminToggle.classList.add('admin-active');
        
        // Habilitar controles de actuadores
        actuatorCards.forEach(card => {
            card.classList.remove('disabled');
        });
    } else {
        // Modo admin desactivado
        adminToggle.textContent = '🔒 Modo Administrador';
        adminToggle.classList.remove('admin-active');
        
        // Deshabilitar controles de actuadores
        actuatorCards.forEach(card => {
            card.classList.add('disabled');
        });
    }
}

// Función para manejar Enter en el input de contraseña
document.addEventListener('DOMContentLoaded', function() {
    const auth = window.getAuth(window.app);
    window.onAuthStateChanged(auth, (user) => {
        if (user) {
            isAdmin = true;
            authUser = user;
        } else {
            isAdmin = false;
            authUser = null;
        }
        updateAdminUI();
    });

    const passwordInput = document.getElementById('passwordInput');
    if (passwordInput) {
        passwordInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                checkPassword();
            }
        });
    }
    
    // Cerrar modal al hacer clic fuera de él
    const modal = document.getElementById('loginModal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeLoginModal();
            }
        });
    }
    
    // Event listeners para modal de rangos
    const rangesModal = document.getElementById('rangesModal');
    if (rangesModal) {
        rangesModal.addEventListener('click', function(e) {
            if (e.target === rangesModal) {
                closeRangesModal();
            }
        });
    }
    
    // Event listeners para modal de programación de luces
    const lightScheduleModal = document.getElementById('lightScheduleModal');
    if (lightScheduleModal) {
        lightScheduleModal.addEventListener('click', function(e) {
            if (e.target === lightScheduleModal) {
                closeLightScheduleModal();
            }
        });
    }
});

// Función modificada para alternar actuadores (solo si es admin)
async function toggleActuator(actuatorName) {
    if (!isAdmin) {
        addAlert('Debes activar el modo administrador para controlar los actuadores', 'warning');
        return;
    }
    
    if (isAutoMode) {
        addAlert('No puedes controlar actuadores en modo automático', 'warning');
        return;
    }
    
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

// ===== FUNCIONES PARA MODO DE CONTROL =====

// Función para alternar modo de control
async function toggleControlMode() {
    if (!isAdmin) {
        addAlert('Debes activar el modo administrador para cambiar el modo de control', 'warning');
        return;
    }
    
    isAutoMode = !isAutoMode;
    updateModeUI();
    
    // Enviar cambio a Firebase
    await sendAutoModeToFirebase(isAutoMode);
}

// Función para actualizar UI del modo de control
function updateModeUI() {
    const modeToggle = document.getElementById('modeToggle');
    const modeText = document.getElementById('modeText');
    
    if (isAutoMode) {
        modeToggle.classList.remove('manual-mode');
        modeToggle.classList.add('auto-mode');
        modeText.textContent = 'Automático';
        modeToggle.innerHTML = '<i class="fas fa-robot"></i> <span id="modeText">Automático</span>';
    } else {
        modeToggle.classList.remove('auto-mode');
        modeToggle.classList.add('manual-mode');
        modeText.textContent = 'Manual';
        modeToggle.innerHTML = '<i class="fas fa-hand-paper"></i> <span id="modeText">Manual</span>';
    }
    
    // Actualizar estado de los actuadores basado en el modo
    updateActuatorDisplays();
}

// ===== FUNCIONES PARA MODAL DE RANGOS =====

// Función para mostrar modal de rangos
function showRangesModal() {
    if (!isAdmin) {
        addAlert('Debes activar el modo administrador para configurar rangos', 'warning');
        return;
    }
    
    const modal = document.getElementById('rangesModal');
    const errorDiv = document.getElementById('rangesError');
    
    // Ocultar errores
    errorDiv.style.display = 'none';
    
    // Cargar valores actuales en los inputs
    document.getElementById('tempMin').value = controlRanges.tempMin;
    document.getElementById('tempMax').value = controlRanges.tempMax;
    document.getElementById('humMin').value = controlRanges.humMin;
    document.getElementById('humMax').value = controlRanges.humMax;
    document.getElementById('humExtractorMin').value = controlRanges.humExtractorMin;
    
    // Mostrar modal
    modal.style.display = 'block';
}

// Función para cerrar modal de rangos
function closeRangesModal() {
    const modal = document.getElementById('rangesModal');
    modal.style.display = 'none';
}

// Función para actualizar UI de rangos
function updateRangesUI() {
    // Solo actualizar si el modal está abierto
    const modal = document.getElementById('rangesModal');
    if (modal.style.display === 'block') {
        document.getElementById('tempMin').value = controlRanges.tempMin;
        document.getElementById('tempMax').value = controlRanges.tempMax;
        document.getElementById('humMin').value = controlRanges.humMin;
        document.getElementById('humMax').value = controlRanges.humMax;
        document.getElementById('humExtractorMin').value = controlRanges.humExtractorMin;
    }
}

// Función para validar rangos
function validateRanges(ranges) {
    const errors = [];
    
    if (ranges.tempMin >= ranges.tempMax) {
        errors.push('La temperatura mínima debe ser menor que la máxima');
    }
    
    if (ranges.humMin >= ranges.humMax) {
        errors.push('La humedad mínima debe ser menor que la máxima');
    }
    
    if (ranges.tempMin < 15 || ranges.tempMax > 35) {
        errors.push('La temperatura debe estar entre 15°C y 35°C');
    }
    
    if (ranges.humMin < 50 || ranges.humMax > 95) {
        errors.push('La humedad debe estar entre 50% y 95%');
    }
    
    if (ranges.humExtractorMin < 80 || ranges.humExtractorMin > 95) {
        errors.push('El umbral del extractor debe estar entre 80% y 95%');
    }
    
    return errors;
}

// Función para guardar rangos
async function saveRanges() {
    const errorDiv = document.getElementById('rangesError');
    
    // Obtener valores de los inputs
    const newRanges = {
        tempMin: parseFloat(document.getElementById('tempMin').value),
        tempMax: parseFloat(document.getElementById('tempMax').value),
        humMin: parseFloat(document.getElementById('humMin').value),
        humMax: parseFloat(document.getElementById('humMax').value),
        humExtractorMin: parseFloat(document.getElementById('humExtractorMin').value)
    };
    
    // Validar rangos
    const errors = validateRanges(newRanges);
    if (errors.length > 0) {
        errorDiv.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            <span>${errors.join('<br>')}</span>
        `;
        errorDiv.style.display = 'block';
        return;
    }
    
    // Ocultar errores
    errorDiv.style.display = 'none';
    
    // Actualizar rangos locales
    controlRanges = { ...newRanges };
    
    // Enviar a Firebase
    await sendRangesToFirebase();
    
    // Cerrar modal
    closeRangesModal();
}

// Función para restablecer rangos a valores por defecto
function resetRanges() {
    document.getElementById('tempMin').value = 23.0;
    document.getElementById('tempMax').value = 28.0;
    document.getElementById('humMin').value = 80.0;
    document.getElementById('humMax').value = 90.0;
    document.getElementById('humExtractorMin').value = 90.0;
    
    // Ocultar errores
    const errorDiv = document.getElementById('rangesError');
    errorDiv.style.display = 'none';
}

// Agregar animación de shake para errores
const style = document.createElement('style');
style.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-5px); }
        75% { transform: translateX(5px); }
    }
`;
document.head.appendChild(style);

// ===== FUNCIONES PARA PROGRAMACIÓN DE LUCES =====

// Función para actualizar programación de luces desde Firebase
function updateLightScheduleFromFirebase(data) {
    if (data.mode !== undefined) lightSchedule.mode = data.mode;
    
    if (data.schedule) {
        if (data.schedule.startHour !== undefined) lightSchedule.schedule.startHour = data.schedule.startHour;
        if (data.schedule.startMin !== undefined) lightSchedule.schedule.startMin = data.schedule.startMin;
        if (data.schedule.endHour !== undefined) lightSchedule.schedule.endHour = data.schedule.endHour;
        if (data.schedule.endMin !== undefined) lightSchedule.schedule.endMin = data.schedule.endMin;
    }
    
    if (data.cycle) {
        if (data.cycle.onHours !== undefined) lightSchedule.cycle.onHours = data.cycle.onHours;
        if (data.cycle.offHours !== undefined) lightSchedule.cycle.offHours = data.cycle.offHours;
    }
    
    console.log('Programación de luces actualizada desde Firebase:', lightSchedule);
    
    // Actualizar UI si el modal está abierto
    updateLightScheduleUI();
}

// Función para cargar programación de luces desde Firebase
async function loadLightScheduleFromFirebase() {
    if (!window.db || !window.ref || !window.get) {
        console.error('Firebase no está disponible para leer programación de luces');
        return;
    }

    try {
        const lightScheduleRef = window.ref(window.db, 'LightSchedule');
        const snapshot = await window.get(lightScheduleRef);
        
        if (snapshot.exists()) {
            const data = snapshot.val();
            updateLightScheduleFromFirebase(data);
            console.log('Programación de luces cargada desde Firebase:', data);
        } else {
            console.log('No hay programación de luces en Firebase, usando valores por defecto');
            // Enviar programación por defecto a Firebase
            await sendLightScheduleToFirebase();
        }
    } catch (error) {
        console.error('Error al cargar programación de luces desde Firebase:', error);
    }
}

// Función para enviar programación de luces a Firebase
async function sendLightScheduleToFirebase() {
    if (!window.db || !window.ref || !window.set) {
        console.error('Firebase no está disponible para escribir programación de luces');
        return;
    }
    
    try {
        const lightScheduleRef = window.ref(window.db, 'LightSchedule');
        await window.set(lightScheduleRef, {
            mode: lightSchedule.mode,
            schedule: {
                startHour: lightSchedule.schedule.startHour,
                startMin: lightSchedule.schedule.startMin,
                endHour: lightSchedule.schedule.endHour,
                endMin: lightSchedule.schedule.endMin
            },
            cycle: {
                onHours: lightSchedule.cycle.onHours,
                offHours: lightSchedule.cycle.offHours
            }
        });
        
        console.log('Programación de luces enviada a Firebase:', lightSchedule);
        addAlert('Programación de luces actualizada correctamente', 'success');
    } catch (error) {
        console.error('Error al enviar programación de luces a Firebase:', error);
        addAlert('Error al actualizar programación de luces', 'danger');
    }
}

// Función para mostrar modal de programación de luces
function showLightScheduleModal() {
    if (!isAdmin) {
        addAlert('Debes activar el modo administrador para programar las luces', 'warning');
        return;
    }
    
    const modal = document.getElementById('lightScheduleModal');
    const errorDiv = document.getElementById('lightScheduleError');
    
    // Ocultar errores
    errorDiv.style.display = 'none';
    
    // Cargar valores actuales en los inputs
    updateLightScheduleUI();
    
    // Configurar event listeners para los radio buttons
    setupLightScheduleEventListeners();
    
    // Mostrar modal
    modal.style.display = 'block';
}

// Función para cerrar modal de programación de luces
function closeLightScheduleModal() {
    const modal = document.getElementById('lightScheduleModal');
    modal.style.display = 'none';
}

// Función para actualizar UI de programación de luces
function updateLightScheduleUI() {
    const modal = document.getElementById('lightScheduleModal');
    if (modal.style.display !== 'block') return;
    
    // Actualizar radio buttons
    const modeRadios = document.querySelectorAll('input[name="lightMode"]');
    modeRadios.forEach(radio => {
        radio.checked = radio.value === lightSchedule.mode;
    });
    
    // Actualizar campos de horario
    const startHour = String(lightSchedule.schedule.startHour).padStart(2, '0');
    const startMin = String(lightSchedule.schedule.startMin).padStart(2, '0');
    const endHour = String(lightSchedule.schedule.endHour).padStart(2, '0');
    const endMin = String(lightSchedule.schedule.endMin).padStart(2, '0');
    
    document.getElementById('startTime').value = `${startHour}:${startMin}`;
    document.getElementById('endTime').value = `${endHour}:${endMin}`;
    
    // Actualizar campos de ciclo
    document.getElementById('onHours').value = lightSchedule.cycle.onHours;
    document.getElementById('offHours').value = lightSchedule.cycle.offHours;
    
    // Mostrar/ocultar secciones según el modo
    showLightScheduleSection(lightSchedule.mode);
    
    // Actualizar previews
    updateSchedulePreview();
    updateCyclePreview();
}

// Función para configurar event listeners
function setupLightScheduleEventListeners() {
    const modeRadios = document.querySelectorAll('input[name="lightMode"]');
    modeRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            showLightScheduleSection(this.value);
        });
    });
    
    // Event listeners para preview en tiempo real
    document.getElementById('startTime').addEventListener('change', updateSchedulePreview);
    document.getElementById('endTime').addEventListener('change', updateSchedulePreview);
    document.getElementById('onHours').addEventListener('input', updateCyclePreview);
    document.getElementById('offHours').addEventListener('input', updateCyclePreview);
}

// Función para mostrar/ocultar secciones según el modo
function showLightScheduleSection(mode) {
    const sections = ['manualConfig', 'scheduleConfig', 'cycleConfig'];
    
    sections.forEach(sectionId => {
        const section = document.getElementById(sectionId);
        section.style.display = 'none';
    });
    
    switch(mode) {
        case 'manual':
            document.getElementById('manualConfig').style.display = 'block';
            break;
        case 'schedule':
            document.getElementById('scheduleConfig').style.display = 'block';
            break;
        case 'cycle':
            document.getElementById('cycleConfig').style.display = 'block';
            break;
    }
}

// Función para actualizar preview de horario
function updateSchedulePreview() {
    const startTime = document.getElementById('startTime').value;
    const endTime = document.getElementById('endTime').value;
    
    document.getElementById('previewStart').textContent = startTime;
    document.getElementById('previewEnd').textContent = endTime;
}

// Función para actualizar preview de ciclo
function updateCyclePreview() {
    const onHours = parseInt(document.getElementById('onHours').value) || 0;
    const offHours = parseInt(document.getElementById('offHours').value) || 0;
    const totalHours = onHours + offHours;
    
    document.getElementById('previewOnHours').textContent = onHours;
    document.getElementById('previewOffHours').textContent = offHours;
    document.getElementById('previewTotalHours').textContent = totalHours;
}

// Función para validar programación de luces
function validateLightSchedule(mode, scheduleData, cycleData) {
    const errors = [];
    
    if (mode === 'schedule') {
        const startTime = scheduleData.startHour * 60 + scheduleData.startMin;
        const endTime = scheduleData.endHour * 60 + scheduleData.endMin;
        
        if (startTime === endTime) {
            errors.push('La hora de encendido y apagado no pueden ser iguales');
        }
    }
    
    if (mode === 'cycle') {
        if (cycleData.onHours < 1 || cycleData.onHours > 24) {
            errors.push('Las horas de encendido deben estar entre 1 y 24');
        }
        if (cycleData.offHours < 1 || cycleData.offHours > 24) {
            errors.push('Las horas de apagado deben estar entre 1 y 24');
        }
        if (cycleData.onHours + cycleData.offHours > 48) {
            errors.push('El ciclo total no puede superar las 48 horas');
        }
    }
    
    return errors;
}

// Función para guardar programación de luces
async function saveLightSchedule() {
    const errorDiv = document.getElementById('lightScheduleError');
    
    // Obtener modo seleccionado
    const selectedMode = document.querySelector('input[name="lightMode"]:checked').value;
    
    // Obtener datos de horario
    const startTime = document.getElementById('startTime').value.split(':');
    const endTime = document.getElementById('endTime').value.split(':');
    const scheduleData = {
        startHour: parseInt(startTime[0]),
        startMin: parseInt(startTime[1]),
        endHour: parseInt(endTime[0]),
        endMin: parseInt(endTime[1])
    };
    
    // Obtener datos de ciclo
    const cycleData = {
        onHours: parseInt(document.getElementById('onHours').value) || 12,
        offHours: parseInt(document.getElementById('offHours').value) || 12
    };
    
    // Validar datos
    const errors = validateLightSchedule(selectedMode, scheduleData, cycleData);
    if (errors.length > 0) {
        errorDiv.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            <span>${errors.join('<br>')}</span>
        `;
        errorDiv.style.display = 'block';
        return;
    }
    
    // Ocultar errores
    errorDiv.style.display = 'none';
    
    // Actualizar datos locales
    lightSchedule.mode = selectedMode;
    lightSchedule.schedule = scheduleData;
    lightSchedule.cycle = cycleData;
    
    // Enviar a Firebase
    await sendLightScheduleToFirebase();
    
    // Cerrar modal
    closeLightScheduleModal();
}

// Función para restablecer programación de luces
function resetLightSchedule() {
    // Valores por defecto
    document.querySelector('input[name="lightMode"][value="manual"]').checked = true;
    document.getElementById('startTime').value = '08:00';
    document.getElementById('endTime').value = '20:00';
    document.getElementById('onHours').value = 12;
    document.getElementById('offHours').value = 12;
    
    // Mostrar sección manual
    showLightScheduleSection('manual');
    
    // Actualizar previews
    updateSchedulePreview();
    updateCyclePreview();
    
    // Ocultar errores
    const errorDiv = document.getElementById('lightScheduleError');
    errorDiv.style.display = 'none';
}

// Hacer funciones globales
window.toggleAdminMode = toggleAdminMode;
window.closeLoginModal = closeLoginModal;
window.checkPassword = checkPassword;
window.toggleControlMode = toggleControlMode;
window.showRangesModal = showRangesModal;
window.closeRangesModal = closeRangesModal;
window.saveRanges = saveRanges;
window.resetRanges = resetRanges;
window.showLightScheduleModal = showLightScheduleModal;
window.closeLightScheduleModal = closeLightScheduleModal;
window.saveLightSchedule = saveLightSchedule;
window.resetLightSchedule = resetLightSchedule;
