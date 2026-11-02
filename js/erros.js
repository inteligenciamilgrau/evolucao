/* Mostra erros de JavaScript no aviso do mapa (em vez de a página só ficar em branco). */
window.addEventListener("error", function (e) {
  var msg = "Erro: " + e.message + " (" + (e.filename || "").split("/").pop() + ":" + e.lineno + ")";
  document.documentElement.setAttribute("data-erro", msg);
  var el = document.getElementById("aviso");
  if (el) { el.hidden = false; el.textContent = msg; }
});
