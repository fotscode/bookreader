const { remote } = require("electron");

var pageNum = 1;
var pageIsRendering = false;
var pageNumIsPending = null;
var scale = 1;
var isPdf = false;
var pdfDoc;

var book = null,
    globalPath,
    rendition;

var file;

// using browse button
function openAndRender() {
    let input = document.createElement("input");
    input.type = "file";

    input.onchange = (e) => {
        file = e.target.files[0];
        if (file.path.endsWith(".pdf") || file.path.endsWith(".epub"))
            setDefaultValues();
        if (file.path.endsWith(".pdf")) {
            renderPDF(file.path);
        } else if (file.path.endsWith(".epub")) {
            renderEPUB(file.path);
        } else {
            alert("Unknown file type");
        }
    };

    input.click();
}

// allows dropping files onto the app
window.onload = () => {
    var getJSONDataReq = new XMLHttpRequest();
    getJSONDataReq.onload = fillSelect;
    getJSONDataReq.open("get", "history.json", true);
    getJSONDataReq.send();

    const dropArea = document.getElementById("main-content");

    dropArea.ondragover = function (e) {
        e.preventDefault();
    };

    dropArea.ondrop = function (e) {
        e.preventDefault();
        file = e.dataTransfer.files[0];
        let path = file.path;
        console.log(path);
        setDefaultValues();

        if (path.endsWith(".pdf")) {
            renderPDF(path);
        } else if (path.endsWith(".epub")) {
            renderEPUB(path);
        } else {
            alert("Unknown file type");
        }
    };
};

function fillSelect(elements) {
    dataJSON = elements.target.response;
    let history = JSON.parse(elements.target.response);

    let select = document.getElementById("chapter");

    for (key in history) {
        select.options[select.options.length] = new Option(
            key,
            history[key].path
        );
    }
}

function getFileName(path) {
    let str = path.split("\\");
    str = str[str.length - 1].replace(".epub", "");
    str = str.replace(".pdf", "");
    return str;
}

// clears previous elements and displays what's needed in both filetypes, PDF and EPUB
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

// renders PDF page
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
        document.querySelector("#page-num").value = num;
    });
};

function renderPDF(path) {
    DOMPDFsettings();
    remote.BrowserWindow.getFocusedWindow().setTitle(getFileName(path));
    isPdf = true;
    console.log(document.getElementById("chapter"));
    pageNum = 1;
    pageIsRendering = false;
    pageNumIsPending = null;

    // get Document
    pdfjsLib.getDocument(path).promise.then((pdfDoc_) => {
        pdfDoc = pdfDoc_;
        document.querySelector("#page-count").textContent = pdfDoc.numPages;
        renderPage(pageNum);
    });
}

function renderEPUB(path) {
    DOMEPUBsettings();
    globalPath = path;
    remote.BrowserWindow.getFocusedWindow().setTitle(getFileName(path));
    const selectObject = document.getElementById("chapter");
    const savedCfi = displaySavedBook(globalPath);
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

    // navigation in dropdown
    book.loaded.navigation.then(function (toc) {
        var options = {};
        var addTocItems = function (tocItems) {
            tocItems.forEach(function (chapter) {
                let chapterLabel = chapter.label.replace(/[\n]/g, "");
                let chapterHREF = chapter.href.replace("%21", "!");
                options[chapterLabel] = chapterHREF.replace(/[\n]/g, "").trim();
                if (chapter.subitems) {
                    addTocItems(chapter.subitems);
                }
            });
        };
        addTocItems(toc);

        // fills nav options
        for (var x in options) {
            selectObject.options[selectObject.options.length] = new Option(
                x,
                options[x]
            );
        }
    });
}

// functions that change DOM depending which content is loaded

function DOMPDFsettings() {
    book = null;
    document.getElementById("app-name").innerText = "PDF";
    document.getElementById("main-content").style.overflowY = "scroll";
    document.getElementById("chapter-label").style.display = "none";
    document.getElementById("chapter").style.display = "none";
    document.getElementById("slider-label").innerText = "SCALE";
    document.getElementById("page-info").style.display = "inline";
}

function DOMEPUBsettings() {
    document.getElementById("app-name").innerText = "EPUB";
    document.getElementById("main-content").style.overflowY = "hidden";
    document.getElementById("chapter-label").innerText = "CHAPTER";
    document.getElementById("chapter").style.display = "inline";
    document.getElementById("slider-label").innerText = "FONT-SIZE";
    document.getElementById("slider").value = "16";
    document.getElementById("page-info").style.display = "none";
}

function removePDF() {
    isPdf = false;
    const canvas = document.querySelector("#pdf-render");
    const context = canvas.getContext("2d");
    pdfDoc = null;
    canvas.height = 0;
    canvas.width = 0;
    context.clearRect(0, 0, canvas.width, canvas.height);
}

// removes options from the dropdown

function removeOptions(selectElement) {
    var i,
        L = selectElement.options.length - 1;
    for (i = L; i >= 0; i--) {
        selectElement.remove(i);
    }
}

// displays chapter selected from dropdown

function handleSelected() {
    let selectObject = document.getElementById("chapter");
    if (book === null) {
        setDefaultValues();
        renderEPUB(selectObject[selectObject.selectedIndex].value);
    } else {
        rendition.display(selectObject[selectObject.selectedIndex].value);
    }
}

function displaySavedBook(path) {
    let parse = JSON.parse(dataJSON);
    for (log in parse) {
        if (log === getFileName(path)) {
            return parse[log].cfi;
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

// handle specific page | PDF only
handlePage = () => {
    let num = event.target.value;
    if (num < 1 || num > pdfDoc.numPages) return;
    pageNum = parseInt(num);
    queueRenderPage(pageNum);
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
    let pdfContainer = document.getElementById("main-content");
    let scroll = pdfContainer.scrollHeight / 3;
    let slider = document.getElementById("slider");
    switch (e.key) {
        case "PageDown":
            e.preventDefault();
            if (isPdf) {
                if (
                    pdfContainer.scrollHeight - pdfContainer.scrollTop ===
                    pdfContainer.clientHeight
                )
                    showNextPage();
                else pdfContainer.scrollTop += 9999;
            } else {
                showNextPage();
            }
            break;
        case "ArrowRight":
            e.preventDefault();
            showNextPage();
            break;
        case "PageUp":
            e.preventDefault();
            if (isPdf) {
                if (pdfContainer.scrollTop === 0) showPrevPage();
                else pdfContainer.scrollTop -= 9999;
            } else {
                showPrevPage();
            }
            break;
        case "ArrowLeft":
            e.preventDefault();
            showPrevPage();
            break;
        case "ArrowDown":
            e.preventDefault();
            if (!isPdf) return;
            pdfContainer.scrollTop += scroll;
            break;
        case "ArrowUp":
            e.preventDefault();
            if (!isPdf) return;
            pdfContainer.scrollTop -= scroll;
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

// zoom in, zoom out using ctrl+ and ctrl- respectively

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

handleClose = () => {
    if (book !== null) {
        saveFileHistory();
    } else if (isPdf) {
        remote.BrowserWindow.getFocusedWindow().reload();
    } else {
        remote.BrowserWindow.getFocusedWindow().close();
    }
};

handleMaximize = () => {
    let window = remote.BrowserWindow.getFocusedWindow();
    window.isMaximized() ? window.unmaximize() : window.maximize();
};

function saveFileHistory() {
    historyArray = JSON.parse(dataJSON);
    let actualCfi = rendition.location.start.cfi;
    historyArray[getFileName(globalPath)] = {
        path: globalPath,
        cfi: actualCfi,
    };

    var fs = require("fs");
    fs.writeFile(
        "src/history.json",
        JSON.stringify(historyArray),
        function (err) {
            if (err) {
                console.log(err);
            }
        }
    );
}
