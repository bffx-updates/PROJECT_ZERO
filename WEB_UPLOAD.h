#ifndef WEB_UPLOAD_H
#define WEB_UPLOAD_H

#include <Arduino.h>

static inline bool web_valid_upload_path(const char *path) {
  if (!path || path[0] != '/') {
    return false;
  }

  const size_t len = strlen(path);
  if (len < 2 || len >= sizeof(webUploadPath)) {
    return false;
  }

  if (strstr(path, "..") || strchr(path, '\\')) {
    return false;
  }

  return true;
}

static inline void web_handle_upload_done() {
  webServer.send_P(200, WEB_CONTENT_TYPE_TEXT, PSTR("UPLOAD OK"));
}

static inline void web_handle_upload_stream() {
  HTTPUpload &upload = webServer.upload();

  if (upload.status == UPLOAD_FILE_START) {
    const char *targetPath = "/upload.bin";
    if (webServer.hasArg("path") &&
        web_valid_upload_path(webServer.arg("path").c_str())) {
      targetPath = webServer.arg("path").c_str();
    }

    strncpy(webUploadPath, targetPath, sizeof(webUploadPath) - 1);
    webUploadPath[sizeof(webUploadPath) - 1] = '\0';

    if (LittleFS.exists(webUploadPath)) {
      LittleFS.remove(webUploadPath);
    }

    webUploadFile = LittleFS.open(webUploadPath, "w");
    sys_log_i("web", "Upload inicio: %s", webUploadPath);
  } else if (upload.status == UPLOAD_FILE_WRITE) {
    if (webUploadFile) {
      webUploadFile.write(upload.buf, upload.currentSize);
    }
  } else if (upload.status == UPLOAD_FILE_END) {
    if (webUploadFile) {
      webUploadFile.close();
    }
    sys_log_i("web", "Upload fim: %s bytes=%u", webUploadPath,
              (unsigned)upload.totalSize);
  } else if (upload.status == UPLOAD_FILE_ABORTED) {
    if (webUploadFile) {
      webUploadFile.close();
    }
    sys_log_i("web", "Upload abortado: %s", webUploadPath);
  }
}

static inline void web_register_upload_routes() {
  webServer.on("/upload", HTTP_GET, web_send_upload);
  webServer.on("/upload.html", HTTP_GET, web_send_upload);
  webServer.on("/upload", HTTP_POST, web_handle_upload_done,
               web_handle_upload_stream);
}

#endif // WEB_UPLOAD_H
