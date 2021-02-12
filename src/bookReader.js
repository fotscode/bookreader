// electron remote for setting titles and reloading, minimizing,
// maximizing or closing app
const { remote } = require("electron");

// pdf variables
var pdfjsLib = require("pdfjs-dist/build/pdf.js");
pdfjsLib.GlobalWorkerOptions.workerSrc =
    "../node_modules/pdfjs-dist/build/pdf.worker.js";

var pageNum = 1;
var pageIsRendering = false;
var pageNumIsPending = null;
var scale = 1;
var isPdf = false;
var pdfDoc;

// epub variables
var ePub = require("epubjs/dist/epub.js");
var book = null,
    globalPath,
    rendition;

// using browse button
openAndRender = () => {
    let input = document.createElement("input");
    input.type = "file";

    input.onchange = (e) => {
        let file = e.target.files[0];
        checkExtensionAndRender(file.path);
    };

    input.click();
};

window.onload = () => {
    // requests JSON local file
    let reqJSONData = new XMLHttpRequest();
    reqJSONData.onload = fillSelectWithFiles;
    reqJSONData.open("get", "history.json", true);
    reqJSONData.send();

    // allows dropping files onto the app
    const dropArea = document.getElementById("main-content");

    dropArea.ondragover = function (e) {
        e.preventDefault();
    };

    dropArea.ondrop = function (e) {
        e.preventDefault();
        let file = e.dataTransfer.files[0];
        checkExtensionAndRender(file.path);
    };
};

function checkExtensionAndRender(path) {
    if (path.endsWith(".pdf") || path.endsWith(".epub")) setDefaultValues();
    if (path.endsWith(".pdf")) {
        renderPDF(path);
    } else if (path.endsWith(".epub")) {
        renderEPUB(path);
    } else {
        document.getElementById("main-content").style.backgroundImage =
            "url('imgs/error.png')";
    }
}

function fillSelectWithFiles(elements) {
    dataJSON = elements.target.response;
    let history = JSON.parse(elements.target.response);

    let select = document.getElementById("selector");

    for (fileName in history) {
        select.options[select.options.length] = new Option(
            fileName,
            history[fileName].path
        );
    }
}

// clears previous elements and displays what's needed, both for PDF and EPUB
function setDefaultValues() {
    document.getElementById("page-btns").style.display = "flex";
    document.getElementById("slider-container").style.display = "flex";
    document.getElementById("main-content").style.backgroundSize = "0";
    document.getElementById("area").innerHTML = ""; // removes epub

    // adds event listeners
    document.addEventListener("keydown", kbEvents, false);
    document.addEventListener("mouseup", mouseEvents, false);

    // changes nav bar colors
    document.getElementById("nav-resize").style.backgroundColor = "#f0e8d1";
    document.getElementById("nav-bar").style.backgroundColor = "#f0e8d1";
    let options = document.querySelectorAll(".window-button");

    for (let i = 0; i < options.length; i++) {
        options[i].classList.add("window-rendered");
    }
}

// PDF Section
const renderPage = (num) => {
    pageIsRendering = true;

    pdfDoc.getPage(num).then((page) => {
        const canvas = document.querySelector("#pdf-render");
        const ctx = canvas.getContext("2d");
        const viewport = page.getViewport({ scale });
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        const renderCtx = {
            canvasContext: ctx,
            viewport,
        };

        page.render(renderCtx).promise.then(() => {
            pageIsRendering = false;
            if (pageNumIsPending !== null) {
                renderPage(pageNumIsPending);
                pageNumIsPending = null;
            }
        });

        // output current page
        document.getElementById("page-num").value = num;
    });
};

function renderPDF(path) {
    // configures DOM for PDF type
    DOMPDFsettings();
    remote.BrowserWindow.getFocusedWindow().setTitle(getFileName(path));
    isPdf = true;
    pageNum = 1;
    pageIsRendering = false;
    pageNumIsPending = null;

    // get Document
    pdfjsLib.getDocument(path).promise.then((pdfDoc_) => {
        pdfDoc = pdfDoc_;
        document.getElementById("page-count").textContent = pdfDoc.numPages;
        renderPage(pageNum);
    });
}

function DOMPDFsettings() {
    book = null;
    document.getElementById("app-name").innerText = "PDF";
    document.getElementById("main-content").style.overflowY = "scroll";
    document.getElementById("selector-label").style.display = "none";
    document.getElementById("selector").style.display = "none";
    document.getElementById("slider-label").innerText = "SCALE";
    document.getElementById("page-info").style.display = "inline";
}

// handle specific page | PDF only
handlePage = () => {
    let num = event.target.value;
    if (num < 1 || num > pdfDoc.numPages) return;
    pageNum = parseInt(num);
    queueRenderPage(pageNum);
};

// EPUB Section

function renderEPUB(path) {
    DOMEPUBsettings();
    globalPath = path;
    remote.BrowserWindow.getFocusedWindow().setTitle(getFileName(path));
    const selectObject = document.getElementById("selector");
    const savedCfi = getSavedCFI(globalPath);
    removeOptions(selectObject);
    if (isPdf) removePDF();

    book = ePub(path);

    // designates area where it should be rendered and dimensions
    rendition = book.renderTo("area", {
        width: "90vw", // 90vw
        height: "96vh", // 96vh
    });

    rendition.display(savedCfi);

    rendition.on("keydown", kbEvents, false);
    rendition.on("mouseup", mouseEvents, false);

    // changes default p color
    rendition.themes.default({
        p: { color: "#412c1a !important" },
    });

    // navigation index in dropdown
    book.loaded.navigation.then(function (toc) {
        var tableOfContents = {};
        var addTocItems = function (tocItems) {
            tocItems.forEach(function (chapter) {
                let chapterLabel = chapter.label.replace(/[\n]/g, "");
                let chapterHREF = chapter.href.replace("%21", "!");
                tableOfContents[chapterLabel] = chapterHREF
                    .replace(/[\n]/g, "")
                    .trim();
                if (chapter.subitems) {
                    addTocItems(chapter.subitems);
                }
            });
        };
        addTocItems(toc);

        // fills select options with chapter name and cfi
        for (chapter in tableOfContents) {
            selectObject.options[selectObject.options.length] = new Option(
                chapter,
                tableOfContents[chapter]
            );
        }
    });
}

function DOMEPUBsettings() {
    document.getElementById("app-name").innerText = "EPUB";
    document.getElementById("main-content").style.overflowY = "hidden";
    document.getElementById("selector-label").innerText = "CHAPTER";
    document.getElementById("selector").style.display = "inline";
    document.getElementById("slider-label").innerText = "FONT-SIZE";
    document.getElementById("slider").value = "16";
    document.getElementById("page-info").style.display = "none";
}

function removePDF() {
    isPdf = false;
    pdfDoc = null;
    let canvas = document.querySelector("#pdf-render");
    let context = canvas.getContext("2d");
    canvas.height = 0;
    canvas.width = 0;
    context.clearRect(0, 0, canvas.width, canvas.height);
}

// removes options from the dropdown | EPUB only

function removeOptions(selectElement) {
    let maxIndex = selectElement.options.length - 1;
    for (let i = maxIndex; i >= 0; i--) {
        selectElement.remove(i);
    }
}

// displays book/chapter selected from dropdown | EPUB only

handleSelected = () => {
    let selectObject = document.getElementById("selector");
    if (book === null) {
        checkExtensionAndRender(selectObject[selectObject.selectedIndex].value); //  selectObject[selectObject.selectedIndex].value = path
    } else {
        rendition.display(selectObject[selectObject.selectedIndex].value); // selectObject[selectObject.selectedIndex].value = cfi
    }
};

function getFileName(path) {
    let str = path.split("\\");
    str = str[str.length - 1].replace(".epub", "");
    str = str.replace(".pdf", "");
    return str;
}

function getSavedCFI(path) {
    let history = JSON.parse(dataJSON);
    for (fileName in history) {
        if (fileName === getFileName(path)) {
            return history[fileName].cfi;
        }
    }
}

const queueRenderPage = (num) => {
    document.getElementById("main-content").scrollTop = 0;
    if (pageIsRendering) {
        pageNumIsPending = num;
    } else {
        renderPage(num);
    }
};

const showPrevPage = () => {
    if (isPdf) {
        if (pageNum <= 1) return;
        pageNum--;
        queueRenderPage(pageNum);
    } else {
        rendition.prev();
    }
};

const showNextPage = () => {
    if (isPdf) {
        if (pageNum >= pdfDoc.numPages) return;
        pageNum++;
        queueRenderPage(pageNum);
    } else {
        rendition.next();
    }
};

// handle specific scale
handleScale = () => {
    if (isPdf) {
        scale = (event.target.value / 100) * 3;
        queueRenderPage(pageNum);
    } else {
        setFontSizes();
    }
};

// change font sizes acording to slider value

const setFontSizes = () => {
    let slider = document.getElementById("slider");
    rendition.themes.default({
        p: { "font-size": `${slider.value}px !important` },
        h1: { "font-size": `${parseInt(slider.value) * 2.5}px !important` },
        h2: { "font-size": `${parseInt(slider.value) * 2}px !important` },
        h3: { "font-size": `${parseInt(slider.value) * 1.7}px !important` },
    });
};

// key listeners for better user experience

var kbEvents = function (e) {
    let pdf = document.getElementById("main-content");
    let scroll = pdf.scrollHeight / 3;
    let slider = document.getElementById("slider");
    switch (e.key) {
        case "PageDown":
            e.preventDefault();
            if (isPdf) {
                if (pdf.scrollHeight - pdf.scrollTop === pdf.clientHeight)
                    showNextPage();
                else pdf.scrollTop += 9999;
            } else {
                showNextPage();
            }
            break;
        case "PageUp":
            e.preventDefault();
            if (isPdf) {
                if (pdf.scrollTop === 0) showPrevPage();
                else pdf.scrollTop -= 9999;
            } else {
                showPrevPage();
            }
            break;
        case "ArrowRight":
            e.preventDefault();
            showNextPage();
            break;
        case "ArrowLeft":
            e.preventDefault();
            showPrevPage();
            break;
        case "ArrowDown":
            e.preventDefault();
            if (!isPdf) return;
            pdf.scrollTop += scroll;
            break;
        case "ArrowUp":
            e.preventDefault();
            if (!isPdf) return;
            pdf.scrollTop -= scroll;
            break;
        case "Home":
            e.preventDefault();
            if (!isPdf) return;
            pageNum = 1;
            queueRenderPage(pageNum);
            break;
        case "End":
            e.preventDefault();
            if (!isPdf) return;
            pageNum = pdfDoc.numPages;
            queueRenderPage(pageNum);
            break;
        case "+":
            if (!e.ctrlKey) break;
            if (isPdf) {
                scale += 0.1;
                slider.value = (scale / 3) * 100;
                queueRenderPage(pageNum);
            } else {
                slider.value *= 1.1;
                setFontSizes();
            }
            break;
        case "-":
            if (!e.ctrlKey) break;
            if (isPdf) {
                scale -= 0.1;
                slider.value = (scale / 3) * 100;
                queueRenderPage(pageNum);
            } else {
                slider.value *= 0.9;
                setFontSizes();
            }
            break;
        default:
            break;
    }
};

// mouse4 and mouse5 event listeners for changing pages

function mouseEvents(e) {
    if (!isPdf && book === null) return;
    if (e.button === 3) {
        showNextPage();
    } else if (e.button === 4) {
        showPrevPage();
    }
}

// close, minimize, maximize functions

handleMinimize = () => {
    remote.BrowserWindow.getFocusedWindow().minimize();
};

handleMaximize = () => {
    let window = remote.BrowserWindow.getFocusedWindow();
    window.isMaximized() ? window.unmaximize() : window.maximize();
};

handleClose = () => {
    if (book !== null) {
        remote.BrowserWindow.getFocusedWindow().setTitle("Book Reader");
        saveCFI();
    } else if (isPdf) {
        remote.BrowserWindow.getFocusedWindow().setTitle("Book Reader");
        remote.BrowserWindow.getFocusedWindow().reload();
    } else {
        remote.BrowserWindow.getFocusedWindow().close();
    }
};

function saveCFI() {
    historyLogs = JSON.parse(dataJSON);
    let actualCfi = rendition.location.start.cfi;
    historyLogs[getFileName(globalPath)] = {
        path: globalPath,
        cfi: actualCfi,
    };
    let fs = require("fs");
    fs.writeFile(
        "src/history.json",
        JSON.stringify(historyLogs),
        function (err) {
            if (err) {
                console.log(err);
            }
        }
    );
}
