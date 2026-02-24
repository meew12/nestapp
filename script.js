window.addEventListener("DOMContentLoaded", () => {

const splash = document.getElementById("splash");
const app = document.getElementById("app");

const video = document.getElementById("video");
const overlay = document.getElementById("overlay");
const overlayCtx = overlay.getContext("2d");

const processCanvas = document.getElementById("processCanvas");
const processCtx = processCanvas.getContext("2d");

const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");

let stream;
let scanning = false;
let previousFrame = null;
let shots = [];
let lastShotTime = 0;

/* detection settings */
const FRAME_INTERVAL = 300;
const CHANGE_THRESHOLD = 35;
const PIXEL_CHANGE_REQUIRED = 5000;
const MIN_TIME_BETWEEN_SHOTS = 800;

/* SPLASH */
setTimeout(()=>{
    splash.style.opacity = "0";

    setTimeout(()=>{
        splash.style.display="none";
        app.classList.remove("hidden");
    },800);

},2000);

/* CAMERA */

async function startCamera(){

    try{

        stream = await navigator.mediaDevices.getUserMedia({
            video:{
                facingMode:{ ideal:"environment" }
            },
            audio:false
        });

        video.srcObject = stream;

    }catch(e){

        console.log("Camera error:", e);

        alert("No se pudo acceder a la cámara.\nUsa HTTPS o localhost.");

    }

}

/* RESIZE */

function resizeCanvas(){

    overlay.width = video.clientWidth;
    overlay.height = video.clientHeight;

    processCanvas.width = 320;
    processCanvas.height = 240;
}

video.addEventListener("loadedmetadata", resizeCanvas);
window.addEventListener("resize", resizeCanvas);

/* BUTTONS */

startBtn.onclick = ()=>{
    scanning = true;
    previousFrame = null;
};

stopBtn.onclick = ()=>{
    scanning = false;
};

/* DETECTION LOOP */

setInterval(()=>{

    if(!scanning) return;
    if(video.readyState !== 4) return;

    processCtx.drawImage(video,0,0,320,240);

    const frame = processCtx.getImageData(0,0,320,240);

    if(previousFrame){

        let diffCount = 0;

        for(let i=0;i<frame.data.length;i+=4){

            const r = Math.abs(frame.data[i] - previousFrame.data[i]);
            const g = Math.abs(frame.data[i+1] - previousFrame.data[i+1]);
            const b = Math.abs(frame.data[i+2] - previousFrame.data[i+2]);

            const diff = (r+g+b)/3;

            if(diff > CHANGE_THRESHOLD){
                diffCount++;
            }

        }

        const now = Date.now();

        if(
            diffCount > PIXEL_CHANGE_REQUIRED &&
            now - lastShotTime > MIN_TIME_BETWEEN_SHOTS
        ){
            registerShot();
            lastShotTime = now;
        }

    }

    previousFrame = frame;

}, FRAME_INTERVAL);

/* REGISTER SHOT */

function registerShot(){

    const x = Math.random() * overlay.width;
    const y = Math.random() * overlay.height;

    shots.forEach(s=>s.color="blue");

    shots.push({
        x,
        y,
        color:"red"
    });

    drawShots();
}

/* DRAW */

function drawShots(){

    overlayCtx.clearRect(0,0,overlay.width,overlay.height);

    shots.forEach(s=>{

        overlayCtx.beginPath();
        overlayCtx.arc(s.x, s.y, 10, 0, Math.PI*2);

        overlayCtx.shadowBlur = 18;
        overlayCtx.shadowColor = s.color;

        overlayCtx.fillStyle = s.color;
        overlayCtx.fill();

        overlayCtx.shadowBlur = 0;

    });

}

/* INIT */

startCamera();

});
