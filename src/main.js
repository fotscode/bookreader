// electron section

const { app, BrowserWindow, Menu } = require("electron");

const url = require("url");
const path = require("path");

let mainWindow;

if (process.env.NODE_ENV !== "production") {
    require("electron-reload")(__dirname, {
        electron: path.join(__dirname, "../node_modules", ".bin", "electron"),
    });
}

app.on("ready", () => {
    mainWindow = new BrowserWindow({
        icon: "src/imgs/books.png",
        frame: false,
        minWidth: 500,
        minHeight: 500,
        webPreferences: {
            nodeIntegration: true,
            enableRemoteModule: true,
        },
    });
    mainWindow.loadURL(
        url.format({
            pathname: path.join(__dirname, "index.html"),
            protocol: "file",
            slashes: true,
        })
    );

    const mainMenu = Menu.buildFromTemplate(templateMenu);
    Menu.setApplicationMenu(mainMenu);
});

const templateMenu = [];

if (process.env.NODE_ENV !== "production") {
    templateMenu.push({
        label: "DevTools",
        submenu: [
            {
                label: "Show Dev Tools",
                accelerator: "CommandOrControl+D",
                click(item, focusedWindow) {
                    focusedWindow.toggleDevTools();
                },
            },
            {
                role: "reload",
            },
        ],
    });
}
