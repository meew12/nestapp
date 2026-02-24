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