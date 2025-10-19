// ==========================================
// IMPACTO - Sistema con Grabación de Audio y Video
// ==========================================

// Obtener elementos del DOM
const canvas = document.getElementById('impactoCanvas');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const btnIniciar = document.getElementById('btnIniciar');
const btnTerminar = document.getElementById('btnTerminar');
const estadoMic = document.getElementById('estadoMic');
const indicadorNivel = document.getElementById('indicadorNivel');
const textoEstado = document.getElementById('textoEstado');
const modalDescarga = document.getElementById('modalDescarga');
const estadoGrabacion = document.getElementById('estadoGrabacion');
const botonesDescarga = document.getElementById('botonesDescarga');
const btnDescargarAudio = document.getElementById('btnDescargarAudio');
const btnDescargarVideo = document.getElementById('btnDescargarVideo');
const btnNuevaSesion = document.getElementById('btnNuevaSesion');

// Array para almacenar todas las ondas activas
let ondas = [];

// Variables para el análisis de audio
let audioContext;
let analizador;
let microfono;
let dataArray;
let bufferLength;

// Variables para grabación
let mediaRecorderCanvas;
let mediaRecorderAudio;
let chunksCanvas = [];
let chunksAudio = [];
let streamCanvas;
let destinationNode;
let grabacionActiva = false;

// Configuración de detección de sonido
const UMBRAL_MINIMO = 30;
const UMBRAL_DEBOUNCE = 200;
let ultimaDeteccion = 0;
let deteccionActiva = false;

// ==========================================
// SISTEMA DE ESCALAS MUSICALES
// ==========================================

// Escala pentatónica menor (sonido místico)
const escalaPentatonicaMenor = [
    261.63, 311.13, 349.23, 392.00, 466.16,
    523.25, 622.25, 698.46, 783.99, 932.33
];

// Escala mayor etérea (sonido luminoso)
const escalaMayorEterea = [
    261.63, 293.66, 329.63, 392.00, 440.00,
    523.25, 587.33, 659.25, 783.99, 880.00
];

// Escala cromática ambiental
const escalaAmbiental = [
    220.00, 246.94, 277.18, 311.13, 349.23,
    392.00, 440.00, 493.88, 554.37, 622.25
];

let escalaActualIndex = 0;
const escalas = [escalaPentatonicaMenor, escalaMayorEterea, escalaAmbiental];
let escalaActual = escalas[escalaActualIndex];

// ==========================================
// AJUSTAR CANVAS
// ==========================================
function ajustarCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// ==========================================
// GENERAR NOTA MUSICAL (con volumen dinámico y salida dual)
// ==========================================
function generarNota(frecuencia, duracion, intensidad, delay = 0) {
    try {
        if (!audioContext || !destinationNode) return;
        
        const ahora = audioContext.currentTime + delay;
        
        // Oscilador principal
        const oscilador = audioContext.createOscillator();
        const ganancia = audioContext.createGain();
        
        // Filtro para calidez
        const filtro = audioContext.createBiquadFilter();
        filtro.type = 'lowpass';
        filtro.frequency.value = 2000 + (intensidad / 255) * 2000;
        filtro.Q.value = 1;
        
        // Conectar: oscilador -> filtro -> ganancia
        oscilador.connect(filtro);
        filtro.connect(ganancia);
        
        // CONECTAR A DOS DESTINOS:
        // 1. A los altavoces (para escuchar en tiempo real)
        ganancia.connect(audioContext.destination);
        // 2. Al nodo de grabación
        ganancia.connect(destinationNode);
        
        oscilador.frequency.value = frecuencia;
        oscilador.type = 'sine';
        
        // VOLUMEN DINÁMICO: aumenta proporcionalmente con la intensidad
        // Sonidos suaves: volumen bajo (0.03 - 0.08)
        // Sonidos fuertes: volumen alto (0.15 - 0.25)
        const volumenBase = 0.03 + (intensidad / 255) * 0.22;
        
        // Envolvente ADSR
        ganancia.gain.setValueAtTime(0, ahora);
        ganancia.gain.linearRampToValueAtTime(volumenBase, ahora + 0.02);
        ganancia.gain.exponentialRampToValueAtTime(volumenBase * 0.7, ahora + 0.1);
        ganancia.gain.exponentialRampToValueAtTime(volumenBase * 0.5, ahora + duracion * 0.7);
        ganancia.gain.exponentialRampToValueAtTime(0.001, ahora + duracion);
        
        oscilador.start(ahora);
        oscilador.stop(ahora + duracion);
        
        // Armónico (también con volumen proporcional)
        if (Math.random() > 0.3) {
            const osciladorArmonico = audioContext.createOscillator();
            const gananciaArmonica = audioContext.createGain();
            
            osciladorArmonico.connect(gananciaArmonica);
            
            // Conectar también a ambos destinos
            gananciaArmonica.connect(audioContext.destination);
            gananciaArmonica.connect(destinationNode);
            
            osciladorArmonico.frequency.value = frecuencia * 2;
            osciladorArmonico.type = 'sine';
            
            const volumenArmonico = volumenBase * 0.35;
            gananciaArmonica.gain.setValueAtTime(0, ahora);
            gananciaArmonica.gain.linearRampToValueAtTime(volumenArmonico, ahora + 0.03);
            gananciaArmonica.gain.exponentialRampToValueAtTime(0.001, ahora + duracion * 0.8);
            
            osciladorArmonico.start(ahora);
            osciladorArmonico.stop(ahora + duracion);
        }
        
    } catch (error) {
        console.log('Error generando nota:', error);
    }
}

// ==========================================
// GENERAR MELODÍA
// ==========================================
function generarMelodia(intensidad) {
    // Más notas para sonidos más intensos
    const numNotas = Math.floor(1 + (intensidad / 255) * 3);
    const indiceBase = Math.floor((intensidad / 255) * (escalaActual.length - 3));
    
    // Duración más larga para sonidos más intensos
    const duracionBase = 0.3 + (intensidad / 255) * 1.4;
    
    for (let i = 0; i < numNotas; i++) {
        const indiceNota = (indiceBase + i) % escalaActual.length;
        const frecuencia = escalaActual[indiceNota];
        const delay = i * 0.08;
        const duracion = duracionBase + Math.random() * 0.3;
        
        generarNota(frecuencia, duracion, intensidad, delay);
    }
    
    // Acorde para sonidos muy intensos
    if (intensidad > 150) {
        const notasAcorde = [indiceBase, indiceBase + 2, indiceBase + 4];
        notasAcorde.forEach((indice) => {
            const frecuencia = escalaActual[indice % escalaActual.length];
            generarNota(frecuencia, duracionBase * 1.5, intensidad, 0.15);
        });
    }
    
    // Cambiar escala ocasionalmente
    if (Math.random() > 0.9) {
        escalaActualIndex = (escalaActualIndex + 1) % escalas.length;
        escalaActual = escalas[escalaActualIndex];
    }
}

// ==========================================
// CLASE: ONDA DE ENERGÍA SONORA
// ==========================================
class OndaSonora {
    constructor(intensidad) {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.radio = 0;
        this.radioMax = 30 + (intensidad / 255) * 220;
        this.opacidad = 0.8 + (intensidad / 255) * 0.2;
        this.grosor = 1.5 + (intensidad / 255) * 3;
        this.velocidad = 1.5 + (intensidad / 255) * 2.5;
        this.blur = 10 + (intensidad / 255) * 25;
        
        const mezclaAzul = 1 - (intensidad / 255) * 0.4;
        this.color = {
            r: 255,
            g: 200 + mezclaAzul * 55,
            b: 200 + mezclaAzul * 55
        };
    }
    
    actualizar() {
        this.radio += this.velocidad;
        this.velocidad *= 0.98;
        const progreso = this.radio / this.radioMax;
        this.opacidad = Math.pow(1 - progreso, 2);
        this.grosor = Math.max(0.5, this.grosor * 0.99);
        this.blur = Math.max(5, this.blur * 0.98);
    }
    
    dibujar() {
        ctx.save();
        ctx.shadowBlur = this.blur;
        ctx.shadowColor = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${this.opacidad * 0.8})`;
        ctx.strokeStyle = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${this.opacidad})`;
        ctx.lineWidth = this.grosor;
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radio, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.shadowBlur = this.blur * 1.8;
        ctx.strokeStyle = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${this.opacidad * 0.5})`;
        ctx.lineWidth = this.grosor * 0.6;
        ctx.stroke();
        
        ctx.restore();
    }
    
    estaCompleta() {
        return this.radio >= this.radioMax || this.opacidad <= 0.01;
    }
}

// ==========================================
// CLASE: ONDA SECUNDARIA (ECO)
// ==========================================
class OndaEco {
    constructor(x, y, intensidad) {
        this.x = x;
        this.y = y;
        this.radio = 0;
        this.radioMax = 50 + (intensidad / 255) * 180;
        this.opacidad = 0;
        this.opacidadMax = 0.2 + (intensidad / 255) * 0.3;
        this.grosor = 1 + (intensidad / 255) * 1.5;
        this.velocidad = 1.2 + (intensidad / 255) * 1.8;
        this.blur = 8 + (intensidad / 255) * 12;
        this.color = { r: 150, g: 200, b: 255 };
    }
    
    actualizar() {
        this.radio += this.velocidad;
        this.velocidad *= 0.985;
        const progreso = this.radio / this.radioMax;
        
        if (progreso < 0.15) {
            this.opacidad = (progreso / 0.15) * this.opacidadMax;
        } else {
            this.opacidad = this.opacidadMax * Math.pow(1 - progreso, 1.5);
        }
        this.blur = Math.max(5, this.blur * 0.99);
    }
    
    dibujar() {
        ctx.save();
        ctx.shadowBlur = this.blur;
        ctx.shadowColor = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${this.opacidad * 0.7})`;
        ctx.strokeStyle = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${this.opacidad})`;
        ctx.lineWidth = this.grosor;
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radio, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
    
    estaCompleta() {
        return this.radio >= this.radioMax || this.opacidad <= 0.01;
    }
}

// ==========================================
// INICIALIZAR GRABACIÓN
// ==========================================
function iniciarGrabacion() {
    try {
        // Grabar el canvas (video)
        streamCanvas = canvas.captureStream(30); // 30 FPS
        
        // Obtener la pista de audio del destinationNode
        const audioTrack = destinationNode.stream.getAudioTracks()[0];
        
        // Agregar la pista de audio al stream del canvas
        streamCanvas.addTrack(audioTrack);
        
        // Crear un único MediaRecorder con video + audio
        mediaRecorderCanvas = new MediaRecorder(streamCanvas, {
            mimeType: 'video/webm;codecs=vp9,opus',
            videoBitsPerSecond: 2500000,
            audioBitsPerSecond: 128000
        });
        
        mediaRecorderCanvas.ondataavailable = (e) => {
            if (e.data.size > 0) {
                chunksCanvas.push(e.data);
            }
        };
        
        mediaRecorderCanvas.start();
        
        grabacionActiva = true;
        console.log('Grabación iniciada (video + audio)');
        
    } catch (error) {
        console.error('Error al iniciar grabación:', error);
    }
}

// ==========================================
// DETENER GRABACIÓN
// ==========================================
function detenerGrabacion() {
    return new Promise((resolve) => {
        if (!grabacionActiva) {
            resolve();
            return;
        }
        
        // Detener grabación
        if (mediaRecorderCanvas && mediaRecorderCanvas.state !== 'inactive') {
            mediaRecorderCanvas.onstop = () => {
                resolve();
            };
            mediaRecorderCanvas.stop();
        } else {
            resolve();
        }
        
        grabacionActiva = false;
    });
}

// ==========================================
// INICIALIZAR AUDIO Y MICRÓFONO
// ==========================================
async function inicializarAudio() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
            } 
        });
        
        microfono = audioContext.createMediaStreamSource(stream);
        analizador = audioContext.createAnalyser();
        analizador.fftSize = 256;
        analizador.smoothingTimeConstant = 0.3;
        
        microfono.connect(analizador);
        
        bufferLength = analizador.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
        
        // Crear nodo de destino para capturar el audio generado
        destinationNode = audioContext.createMediaStreamDestination();
        
        textoEstado.textContent = 'Micrófono activo';
        estadoMic.classList.add('visible');
        overlay.classList.add('oculto');
        
        // Mostrar botón terminar
        setTimeout(() => {
            btnTerminar.classList.remove('oculto');
        }, 500);
        
        deteccionActiva = true;
        detectarSonido();
        
        // Iniciar grabación
        iniciarGrabacion();
        
        return true;
        
    } catch (error) {
        console.error('Error al acceder al micrófono:', error);
        textoEstado.textContent = 'Error: No se pudo acceder al micrófono';
        estadoMic.classList.add('visible');
        alert('No se pudo acceder al micrófono. Por favor, verifica los permisos del navegador.');
        return false;
    }
}

// ==========================================
// DETECTAR SONIDO
// ==========================================
function detectarSonido() {
    if (!deteccionActiva) return;
    
    analizador.getByteFrequencyData(dataArray);
    
    let suma = 0;
    for (let i = 0; i < bufferLength; i++) {
        suma += dataArray[i];
    }
    const volumenPromedio = suma / bufferLength;
    
    if (volumenPromedio > UMBRAL_MINIMO) {
        indicadorNivel.classList.add('activo');
        indicadorNivel.style.transform = `scale(${1 + (volumenPromedio / 255)})`;
    } else {
        indicadorNivel.classList.remove('activo');
        indicadorNivel.style.transform = 'scale(1)';
    }
    
    const ahora = Date.now();
    const tiempoDesdeUltimaDeteccion = ahora - ultimaDeteccion;
    
    if (volumenPromedio > UMBRAL_MINIMO && tiempoDesdeUltimaDeteccion > UMBRAL_DEBOUNCE) {
        crearImpactoSonoro(volumenPromedio);
        ultimaDeteccion = ahora;
    }
    
    requestAnimationFrame(detectarSonido);
}

// ==========================================
// CREAR IMPACTO SONORO
// ==========================================
function crearImpactoSonoro(intensidad) {
    ondas.push(new OndaSonora(intensidad));
    
    const numEcos = 1 + Math.floor(Math.random() * 2);
    const x = ondas[ondas.length - 1].x;
    const y = ondas[ondas.length - 1].y;
    
    for (let i = 0; i < numEcos; i++) {
        setTimeout(() => {
            const offsetX = (Math.random() - 0.5) * 100;
            const offsetY = (Math.random() - 0.5) * 100;
            ondas.push(new OndaEco(x + offsetX, y + offsetY, intensidad));
        }, i * 100 + 50);
    }
    
    generarMelodia(intensidad);
}

// ==========================================
// TERMINAR SESIÓN
// ==========================================
async function terminarSesion() {
    // Desactivar detección
    deteccionActiva = false;
    
    // Ocultar botón terminar
    btnTerminar.classList.add('oculto');
    
    // Mostrar modal
    modalDescarga.classList.remove('oculto');
    estadoGrabacion.style.display = 'block';
    botonesDescarga.classList.add('oculto');
    
    // Detener grabación
    await detenerGrabacion();
    
    // Simular pequeño delay para procesamiento
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Ocultar spinner y mostrar botones
    estadoGrabacion.style.display = 'none';
    botonesDescarga.classList.remove('oculto');
}

// ==========================================
// DESCARGAR VIDEO CON AUDIO
// ==========================================
function descargarVideo() {
    if (chunksCanvas.length === 0) {
        alert('No hay contenido para descargar');
        return;
    }
    
    const blob = new Blob(chunksCanvas, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `impacto_completo_${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ==========================================
// DESCARGAR SOLO AUDIO (extraído del video)
// ==========================================
function descargarAudio() {
    if (chunksCanvas.length === 0) {
        alert('No hay contenido para descargar');
        return;
    }
    
    // El audio ya está incluido en el video
    // Creamos el mismo blob para que el usuario pueda extraerlo
    const blob = new Blob(chunksCanvas, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `impacto_con_audio_${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    alert('El audio está incluido en el archivo. Puedes extraerlo con herramientas como FFmpeg o convertidores online.');
}

// ==========================================
// NUEVA SESIÓN
// ==========================================
function nuevaSesion() {
    // Limpiar chunks
    chunksCanvas = [];
    chunksAudio = [];
    
    // Limpiar ondas
    ondas = [];
    
    // Limpiar canvas
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Ocultar modal
    modalDescarga.classList.add('oculto');
    
    // Resetear estado
    deteccionActiva = true;
    
    // Mostrar botón terminar nuevamente
    btnTerminar.classList.remove('oculto');
    
    // Reiniciar grabación
    iniciarGrabacion();
    
    // Reiniciar detección
    detectarSonido();
}

// ==========================================
// LOOP DE ANIMACIÓN
// ==========================================
function animar() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.globalCompositeOperation = 'screen';
    
    for (let i = ondas.length - 1; i >= 0; i--) {
        const onda = ondas[i];
        onda.actualizar();
        onda.dibujar();
        
        if (onda.estaCompleta()) {
            ondas.splice(i, 1);
        }
    }
    
    ctx.globalCompositeOperation = 'source-over';
    requestAnimationFrame(animar);
}

// ==========================================
// EVENT LISTENERS
// ==========================================
btnIniciar.addEventListener('click', inicializarAudio);
btnTerminar.addEventListener('click', terminarSesion);
btnDescargarVideo.addEventListener('click', descargarVideo);
btnDescargarAudio.addEventListener('click', descargarAudio);
btnNuevaSesion.addEventListener('click', nuevaSesion);
window.addEventListener('resize', ajustarCanvas);

// ==========================================
// INICIALIZACIÓN
// ==========================================
ajustarCanvas();
ctx.fillStyle = '#000000';
ctx.fillRect(0, 0, canvas.width, canvas.height);
animar();

// ==========================================
// FIN DEL CÓDIGO
// ==========================================