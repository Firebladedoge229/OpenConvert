const server = "https://openconvert-server.fireblade.dev"; 

document.addEventListener("DOMContentLoaded", () => {

  const fileInput = document.getElementById("fileInput");
  const uploadButton = document.getElementById("uploadButton");
  const dropZone = uploadButton;
  const formatSelector = document.querySelector(".set-all-format");
  const convertAllBtn = document.querySelector(".convert-all");
  const downloadZipBtn = document.querySelector(".download-zip");
  const clearBtn = document.querySelector(".clear");
  const setAllFormatText = document.querySelector(".set-all-format-text");
  const previewContainer = document.querySelector(".file-preview-container");

  const IMAGE_FORMATS = [
    "png", "jpeg", "webp", "gif", "bmp", "tiff", "ico", "icns",
    "dds", "eps", "pcx", "ppm", "sgi", "tga", "xbm", "JPEG2000"
  ];

  const VIDEO_FORMATS = [
    "mp4", "webm", "avi", "mkv", "mov", "flv", "wmv", "mpeg", "mpg", "3gp",
    "3g2", "m4v", "ts", "m2ts", "asf", "ogv", "rm", "vob"
  ];

  const AUDIO_FORMATS = [
    "mp3", "wav", "ogg", "aac", "flac", "alac", "wma", "m4a", "opus", "amr",
    "aiff", "ac3"
  ];

  const DOC_FORMATS = [
    "pdf", "docx", "html", "htm", "txt", "md", "markdown", "rst", "tex", "epub",
    "odt", "rtf", "org", "asciidoc", "fb2", "xml", "json", "csv"
  ];

  let uploadedFiles = [];

  uploadButton.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", e => handleFiles(e.target.files));

  dropZone.addEventListener("dragover", e => {
    e.preventDefault();
    dropZone.classList.add("drag-over");
  });
  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
  dropZone.addEventListener("drop", e => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");
    handleFiles(e.dataTransfer.files);
  });

  convertAllBtn.addEventListener("click", async () => {
    convertAllBtn.disabled = true;
    for (const fileObj of uploadedFiles) {
      await convertFile(fileObj);
    }
    convertAllBtn.disabled = false;
    console.log("All conversions done.");
  });

  downloadZipBtn.addEventListener("click", async () => {
    if (!uploadedFiles.length) {
      console.log("No files to download.");
      return;
    }

    const filesToZip = uploadedFiles.filter(f => f.convertedFile);

    if (!filesToZip.length) {
      console.log("No converted files to download.");
      return;
    }

    const zip = new JSZip();

    filesToZip.forEach(({ convertedFile }) => {
      zip.file(convertedFile.name, convertedFile);
    });

    try {
      const content = await zip.generateAsync({ type: "blob" });

      const a = document.createElement("a");
      a.href = URL.createObjectURL(content);
      a.download = "DownloadedFiles.zip";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
      }, 100);
    } catch (err) {
      console.error("Failed to create ZIP:", err);
    }
  });

  clearBtn.addEventListener("click", () => {
    previewContainer.innerHTML = "";
    uploadedFiles = [];
    updateGlobalFormatOptions();
    updateSetAllState();
    console.log("All files cleared.");
  });

  formatSelector.addEventListener("change", () => {
    uploadedFiles.forEach(({ cardElement }) => {
      const select = cardElement.querySelector("select");
      select.value = formatSelector.value;
      const idx = uploadedFiles.findIndex(f => f.cardElement === cardElement);
      if (idx !== -1) uploadedFiles[idx].selectedFormat = select.value;
    });
  });

  function handleFiles(files) {
    Array.from(files).forEach(file => {
      const category = detectCategory([file.type]);
      addFileCard(file, category);
    });
    updateGlobalFormatOptions();
    updateSetAllState();
  }

  function detectCategory(mimeTypes) {
    if (mimeTypes.some(t => t.startsWith("image/"))) return "image";
    if (mimeTypes.some(t => t.startsWith("video/"))) return "video";
    if (mimeTypes.some(t => t.startsWith("audio/"))) return "audio";
    if (mimeTypes.some(t => 
        t === "application/pdf" ||
        t.startsWith("text/") ||
        t.includes("word") ||
        t.includes("officedocument")
    )) return "document";
    return "other";
  }

  function updateGlobalFormatOptions() {
    const categories = new Set(uploadedFiles.map(f => f.category));
    if (categories.size === 1) {
      const category = [...categories][0];
      let formats = [];
      switch (category) {
        case "image": formats = IMAGE_FORMATS; break;
        case "video": formats = VIDEO_FORMATS; break;
        case "audio": formats = AUDIO_FORMATS; break;
        case "document": formats = DOC_FORMATS; break;
        default: formats = [];
      }
      formatSelector.innerHTML = "";
      formats.forEach(f => {
        const option = document.createElement("option");
        option.value = f;
        option.textContent = f.toUpperCase();
        formatSelector.appendChild(option);
      });
      formatSelector.disabled = false;
      setAllFormatText.style.color = "";
    } else {
      formatSelector.innerHTML = "";
      formatSelector.disabled = true;
      setAllFormatText.style.color = "gray";
    }
  }

  function updateSetAllState() {
    if (uploadedFiles.length === 0) {
      formatSelector.disabled = true;
      convertAllBtn.disabled = true;
      downloadZipBtn.disabled = true;
      setAllFormatText.style.color = "gray";
    } else {
      convertAllBtn.disabled = false;
      downloadZipBtn.disabled = false;
    }
  }

  function addFileCard(file, category) {
    const card = document.createElement("div");
    card.className = "file-card";
    card.style.position = "relative";

    const removeBtn = document.createElement("button");
    removeBtn.textContent = "×";
    removeBtn.title = "Remove file";
    removeBtn.style.position = "absolute";
    removeBtn.style.top = "-10px";
    removeBtn.style.left = "5px";
    removeBtn.style.background = "transparent";
    removeBtn.style.border = "none";
    removeBtn.style.fontSize = "40px";
    removeBtn.style.cursor = "pointer";
    removeBtn.style.color = "#FF0000";
    removeBtn.classList.add("remove-button");
    removeBtn.addEventListener("click", () => {
      previewContainer.removeChild(card);
      uploadedFiles = uploadedFiles.filter(f => f.cardElement !== card);
      updateGlobalFormatOptions();
      updateSetAllState();
    });
    card.appendChild(removeBtn);

    const topRight = document.createElement("div");
    topRight.className = "top-right";
    const select = document.createElement("select");
    select.classList.add("toolbar-select");

    let formats = [];
    switch (category) {
      case "image": formats = IMAGE_FORMATS; break;
      case "video": formats = VIDEO_FORMATS; break;
      case "audio": formats = AUDIO_FORMATS; break;
      case "document": formats = DOC_FORMATS; break;
      default: formats = [];
    }
    formats.forEach(f => {
      const option = document.createElement("option");
      option.value = f;
      option.textContent = f.toUpperCase();
      select.appendChild(option);
    });
    select.value = formats[0] || "";
    topRight.appendChild(select);
    card.appendChild(topRight);

    let preview;
    if (file.type.startsWith("image/")) {
      preview = document.createElement("img");
      const reader = new FileReader();
      reader.onload = () => preview.src = reader.result;
      reader.readAsDataURL(file);
    } else {
      preview = document.createElement("div");
      preview.className = "file-icon";
      preview.textContent = file.name.split(".").pop().toUpperCase();
      Object.assign(preview.style, {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#eee",
        fontWeight: "bold",
        fontSize: "1.2rem",
        height: "100%",
        borderRadius: "8px"
      });
    }

    const previewWrapper = document.createElement("div");
    previewWrapper.style.position = "relative";
    previewWrapper.style.width = "100%";
    previewWrapper.style.height = "100%";
    previewWrapper.appendChild(preview);
    card.appendChild(previewWrapper);

    const bottomButtons = document.createElement("div");
    bottomButtons.className = "bottom-buttons";

    const convertBtn = document.createElement("button");
    convertBtn.textContent = "Convert";
    convertBtn.classList.add("toolbar-button");
    const downloadBtn = document.createElement("button");
    downloadBtn.textContent = "Download";
    downloadBtn.classList.add("toolbar-button");
    downloadBtn.disabled = true;

    convertBtn.addEventListener("click", async () => {
      convertBtn.disabled = true;

      await convertFile(uploadedFiles.find(f => f.cardElement === card));
      convertBtn.disabled = false;
      downloadBtn.disabled = false;
    });

    downloadBtn.addEventListener("click", () => {
      const fileObj = uploadedFiles.find(f => f.cardElement === card);
      if (fileObj?.convertedFile) downloadFile(fileObj.convertedFile, fileObj.convertedFile.name);
      else console.log("Please convert the file first.");
    });

    bottomButtons.appendChild(convertBtn);
    bottomButtons.appendChild(downloadBtn);
    card.appendChild(bottomButtons);
    previewContainer.appendChild(card);

    uploadedFiles.push({
      file,
      category,
      cardElement: card,
      selectedFormat: select.value,
      convertedFile: null
    });

    updateGlobalFormatOptions();
    updateSetAllState();

    select.addEventListener("change", () => {
      const idx = uploadedFiles.findIndex(f => f.cardElement === card);
      if (idx !== -1) uploadedFiles[idx].selectedFormat = select.value;
    });
  }

  async function convertFile(fileObj) {
    const { file, selectedFormat, category, cardElement } = fileObj;
    const idx = uploadedFiles.findIndex(f => f.file === file);
    if (idx === -1) return;

    uploadedFiles[idx].convertedFile = null;

    let overlay = document.createElement("div");
    Object.assign(overlay.style, {
      position: "absolute",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      backgroundColor: "rgba(0, 0, 0, 0.5)",  
      zIndex: "20",
      borderRadius: "4px",
    });

    if (getComputedStyle(cardElement).position === "static") {
      cardElement.style.position = "relative";
    }

    cardElement.appendChild(overlay);

    const buttons = cardElement.querySelectorAll("button");
    buttons.forEach(btn => (btn.disabled = true));

    const previewWrapper = cardElement.querySelector("div[style*='position: relative']");
    if (!previewWrapper) {

      previewWrapper = cardElement;
    }

    let spinner = document.createElement("img");
    spinner.src = "./images/convert.png";  
    spinner.alt = "Loading...";
    Object.assign(spinner.style, {
      position: "absolute",
      top: "50%",
      left: "50%",
      width: "60%",
      height: "60%",
      aspectRatio: "1 / 1",
      objectFit: "cover",
      transform: "translate(-50%, -50%)",
      zIndex: "9999",
      pointerEvents: "none",
      animation: "spin 2s linear infinite"
    });

    previewWrapper.appendChild(spinner);

    try {
      const base64Data = await readFileAsBase64(file);
      const fromFormat = getFileExtension(file.name);
      let toFormat = selectedFormat;

      const jsonPayload = {
        from: fromFormat.toUpperCase(),
        to: toFormat.toUpperCase(),
        data: base64Data
      };

      const endpoint = `${server}/convert/${category.toLowerCase()}`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(jsonPayload)
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.statusText}`);
      }

      const blob = await response.blob();
      toFormat = (selectedFormat.toUpperCase() === "JPEG2000") ? "jpx" : selectedFormat;
      const convertedFileName = file.name.replace(/\.[^/.]+$/, "") + "." + toFormat;

      updateConvertedFile(file, new File([blob], convertedFileName, { type: blob.type }));

      const fileObjRef = uploadedFiles[idx];
      if (fileObjRef && fileObjRef.cardElement) {
        const downloadBtn = fileObjRef.cardElement.querySelector("button.toolbar-button:last-child");
        if (downloadBtn) downloadBtn.disabled = false;
      }

      cardElement.style.backgroundColor = "rgb(0 255 126)"; 
      console.log(`Converted "${file.name}" to "${toFormat}". Click Download to save.`);
    } catch (err) {
      cardElement.style.backgroundColor = "rgb(200 0 0)"; 
      console.error("Conversion failed:", err);
      console.log(`Failed to convert "${file.name}": ${err.message}`);
    } finally {

      if (spinner && spinner.parentNode) spinner.parentNode.removeChild(spinner);
      if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);

      buttons.forEach(btn => (btn.disabled = false));
    }
  }

  function updateConvertedFile(originalFile, convertedFile) {
    const idx = uploadedFiles.findIndex(f => f.file === originalFile);
    if (idx !== -1) {
      uploadedFiles[idx].convertedFile = convertedFile;
    }
  }

  function downloadFile(file, filename) {
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  function getFileExtension(filename) {
    return filename.split(".").pop().toLowerCase();
  }

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        let base64 = reader.result;

        base64 = base64.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
});
