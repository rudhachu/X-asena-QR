function render(sessionid){
return `<html>
<head>
<script src="/script.js"></script>
  <meta name="viewport" content="width=device-width, initial-scale=1" /> 
</head>
<h1 id="sessionID">${sessionid}</h1>
<div class="main">
  <button style="--content: 'COPY CODE'" onclick="copy()" id="button">
    <div class="left" ></div>
    COPY CODE
    <div class="right"></div>
  </button>
</div>
</html>

`   
}
module.exports = render