import os from 'os';
import readline from 'readline';
import keypress from 'keypress';
const isType = (arg) => true; // A type guard to enforce a type
/**
 * @description Displays a menu of items in the console and asynchronously waits for the user to select an item.
 *
 * @typedef { import('./console-menu').Item } Item
 * @typedef { import('./console-menu').Options } Options
 *
 * @param {Item[]} items Array of menu items
 * @param {Options} options Dictionary of options for the menu
 * @returns {Promise<Item> | null} A promise that resolves to the chosen item, or to null if the menu was cancelled.
 */
export default async function menu(items, options = {}) {
    var _a, _b;
    if (!items || !Array.isArray(items) || items.length < 1) {
        throw new TypeError('A nonempty Items array is required.');
    }
    options.pageSize = (_a = options.pageSize) !== null && _a !== void 0 ? _a : 0;
    options.helpMessage = (_b = options.helpMessage) !== null && _b !== void 0 ? _b : 'Type a hotkey or use Down/Up arrows then Enter to choose an item.';
    if (!isType(options))
        return null;
    /* Begin */
    const count = items.length;
    let selectedIndex = items.findIndex(item => item.selected);
    if (selectedIndex < 0) {
        selectedIndex = 0;
        while (selectedIndex < count && items[selectedIndex].separator)
            selectedIndex++;
    }
    let scrollOffset = 0;
    printMenu(items, options, selectedIndex, scrollOffset);
    return new Promise((resolve, reject) => {
        process.stdin.setRawMode(true);
        process.stdin.resume();
        keypress(process.stdin);
        const handleMenuKeypress = (ch, key) => {
            let selection = undefined;
            if (isEnter(key)) {
                selection = items[selectedIndex];
            }
            else if (ch) {
                selection = items.find(item => item.hotkey && item.hotkey === ch)
                    || items.find(item => item.hotkey && item.hotkey.toLowerCase() === ch.toLowerCase());
            }
            let newIndex = null;
            if (selection || isCancelCommand(key)) {
                process.stdin.removeListener('keypress', handleMenuKeypress);
                process.stdin.setRawMode(false);
                resetCursor(options, selectedIndex, scrollOffset);
                readline.clearScreenDown(process.stdout);
                process.stdin.pause();
                resolve(selection);
            }
            else if (isUpCommand(key) && selectedIndex > 0) {
                newIndex = selectedIndex - 1;
                while (newIndex >= 0 && items[newIndex].separator)
                    newIndex--;
            }
            else if (isDownCommand(key) && selectedIndex < count - 1) {
                newIndex = selectedIndex + 1;
                while (newIndex < count && items[newIndex].separator)
                    newIndex++;
            }
            else if (isPageUpCommand(key) && selectedIndex > 0) {
                newIndex = (options.pageSize ? Math.max(0, selectedIndex - options.pageSize) : 0);
                while (newIndex < count && items[newIndex].separator)
                    newIndex++;
            }
            else if (isPageDownCommand(key) && selectedIndex < count - 1) {
                newIndex = (options.pageSize
                    ? Math.min(count - 1, selectedIndex + options.pageSize) : count - 1);
                while (newIndex >= 0 && items[newIndex].separator)
                    newIndex--;
            }
            else if (isGoToFirstCommand(key) && selectedIndex > 0) {
                newIndex = 0;
                while (newIndex < count && items[newIndex].separator)
                    newIndex++;
            }
            else if (isGoToLastCommand(key) && selectedIndex < count - 1) {
                newIndex = count - 1;
                while (newIndex >= 0 && items[newIndex].separator)
                    newIndex--;
            }
            if (newIndex !== null && newIndex >= 0 && newIndex < count) {
                resetCursor(options, selectedIndex, scrollOffset);
                selectedIndex = newIndex;
                // Adjust the scroll offset when the selection moves off the page.
                if (selectedIndex < scrollOffset) {
                    scrollOffset = (isPageUpCommand(key)
                        ? Math.max(0, scrollOffset - options.pageSize) : selectedIndex);
                }
                else if (options.pageSize && selectedIndex >= scrollOffset + options.pageSize) {
                    scrollOffset = (isPageDownCommand(key)
                        ? Math.min(count - options.pageSize, scrollOffset + options.pageSize)
                        : selectedIndex - options.pageSize + 1);
                }
                printMenu(items, options, selectedIndex, scrollOffset);
            }
        };
        process.stdin.addListener('keypress', handleMenuKeypress);
    });
}
const isEnter = key => key && (key.name === 'enter' || key.name === 'return');
const isUpCommand = key => key && key.name === 'up';
const isDownCommand = key => key && key.name === 'down';
const isPageUpCommand = key => key && key.name === 'pageup';
const isPageDownCommand = key => key && key.name === 'pagedown';
const isGoToFirstCommand = key => key && key.name === 'home';
const isGoToLastCommand = key => key && key.name === 'end';
const isCancelCommand = key => key && (key.name === 'escape' || (key.ctrl && key.name == 'c'));
function resetCursor(options, selectedIndex, scrollOffset) {
    readline.moveCursor(process.stdout, -3, -(options.header ? 1 : 0)
        - (options.border ? (options.header ? 2 : 1) : 0)
        - selectedIndex + scrollOffset);
}
function printMenu(items, options, selectedIndex, scrollOffset) {
    const repeat = (s, n) => {
        return Array(n + 1).join(s);
    };
    let width = 0;
    for (let i = 0; i < items.length; i++) {
        if (items[i].title && 4 + items[i].title.length > width) {
            width = 4 + items[i].title.length;
        }
    }
    const prefix = (options.border ? '|' : '');
    const suffix = (options.border ? ' |' : '');
    if (options.header && options.header.length > width) {
        width = options.header.length;
    }
    if (options.border) {
        if (!options.header && options.pageSize && scrollOffset > 0) {
            process.stdout.write('.--/\\' + repeat('-', width - 2) + '.' + os.EOL);
        }
        else {
            process.stdout.write('.' + repeat('-', width + 2) + '.' + os.EOL);
        }
    }
    if (options.header) {
        process.stdout.write(prefix + (options.border ? ' ' : '') + options.header +
            repeat(' ', width - options.header.length) + suffix + os.EOL);
        if (options.border) {
            if (options.pageSize && scrollOffset > 0) {
                process.stdout.write('+--/\\' + repeat('-', width - 2) + '+' + os.EOL);
            }
            else {
                process.stdout.write('+' + repeat('-', width + 2) + '+' + os.EOL);
            }
        }
    }
    const scrollEnd = options.pageSize
        ? Math.min(items.length, scrollOffset + options.pageSize)
        : items.length;
    for (let i = scrollOffset; i < scrollEnd; i++) {
        if (items[i].separator) {
            process.stdout.write(prefix + ' ' + repeat(' ', width) + suffix + os.EOL);
        }
        else {
            const hotkey = items[i].hotkey || '*';
            const title = items[i].title || '';
            const label = (i === selectedIndex
                ? '[' + hotkey + ']' : ' ' + hotkey + ')');
            process.stdout.write(prefix + ' ' + label + ' ' + title +
                repeat(' ', width - title.length - 4) + suffix + os.EOL);
        }
    }
    if (options.border) {
        if (options.pageSize && scrollEnd < items.length) {
            process.stdout.write('\'--\\/' + repeat('-', width - 2) + '\'' + os.EOL);
        }
        else {
            process.stdout.write('\'' + repeat('-', width + 2) + '\'' + os.EOL);
        }
    }
    process.stdout.write(options.helpMessage);
    readline.moveCursor(process.stdout, -(options.helpMessage).length + prefix.length + 2, -(options.border ? 1 : 0) - (scrollEnd - scrollOffset) + selectedIndex - scrollOffset);
}
//# sourceMappingURL=console-menu.js.map