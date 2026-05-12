function saveConfig(button) {
  fetch('/save', { method: 'POST' })
    .then(function(response) {
      if (!response.ok) throw new Error('save failed');
      button.textContent = 'SAVED';
      setTimeout(function() {
        button.textContent = 'SAVE';
      }, 900);
    })
    .catch(function() {
      button.textContent = 'ERROR';
      setTimeout(function() {
        button.textContent = 'SAVE';
      }, 1200);
    });
}

var uploadForm = document.getElementById('uploadForm');
if (uploadForm) {
  uploadForm.addEventListener('submit', function(event) {
    event.preventDefault();

    var status = document.getElementById('uploadStatus');
    var path = document.getElementById('pathInput').value || '/upload.bin';
    var file = document.getElementById('fileInput').files[0];

    if (!file) {
      status.textContent = 'Selecione um arquivo.';
      return;
    }

    var body = new FormData();
    body.append('file', file, file.name);
    status.textContent = 'Enviando...';

    fetch('/upload?path=' + encodeURIComponent(path), {
      method: 'POST',
      body: body
    })
      .then(function(response) {
        if (!response.ok) throw new Error('upload failed');
        return response.text();
      })
      .then(function(text) {
        status.textContent = text;
      })
      .catch(function() {
        status.textContent = 'Erro no upload.';
      });
  });
}
