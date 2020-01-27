// A simple interactive console app to test the console-menu module.
import menu from './console-menu';
const IS_DEV = process.env.NODE_ENV === 'development';
if (IS_DEV)
    console.clear();
const loop = () => menu([
    { separator: true },
    { hotkey: '1', title: 'One' },
    { hotkey: '2', title: 'Two', selected: true },
    { hotkey: '3', title: 'Three' },
    { hotkey: '4', title: 'Four' },
    { separator: true },
    { hotkey: '0', title: 'Do something else...', cascade: true },
    { separator: true },
    { hotkey: '?', title: 'Help' },
    { hotkey: 'C', title: 'Clear Console' },
    { hotkey: 'X', title: 'Exit loop' },
], {
    header: 'Test menu',
    border: true,
}).then(item => {
    if (!item) {
        return null;
    }
    else if (!item.cascade) {
        return item;
    }
    else {
        console.log('You chose: ' + JSON.stringify(item));
        return menu(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']
            .map(hotkey => ({
            hotkey,
            title: 'Item ' + hotkey.toUpperCase(),
            subitem: true,
        })), {
            header: 'Another menu',
            border: true,
            pageSize: 5,
        });
    }
}).then(item => {
    if (item) {
        console.log('You chose: ' + JSON.stringify(item));
        if (item.hotkey === 'C')
            console.clear();
        if (item.hotkey === 'X')
            return;
    }
    else {
        console.log('You cancelled the menu.');
    }
    return IS_DEV && loop();
});
loop();
//# sourceMappingURL=example.js.map