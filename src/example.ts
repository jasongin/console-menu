// A simple interactive console app to test the console-menu module.
import menu, { Item, Action, Options, Functional } from './console-menu'

const IS_DEV = process.env.NODE_ENV === 'development'

if (IS_DEV) console.clear()

interface FirstLevel extends Item {
  cascade?: boolean
  prevent?: boolean
  actions?: any
}



interface SecondLevelItem extends Item {
  subitem: true
}

type SecondLevel = FirstLevel | SecondLevelItem | null


const design = (increment: number): Action<FirstLevel> => (item, options) => options.designId += increment
const designTitle: Functional<string> = (item, options) => `Switch design 🠔${options.designId}🠖`

const border: Action<FirstLevel> = (item, options, { console: { moveCursor, clearScreenDown }}) => {
  options.border = !options.border

  moveCursor(0, (options.header ? 2 : 1) * (options.border ? 1 : -1))
  clearScreenDown()
}

const header: Action<FirstLevel> = (item, options, { console: { moveCursor, clearScreenDown }}) => {
  //@ts-ignore
  const t = options._header
  //@ts-ignore
  options._header = options.header
  options.header = t

  moveCursor(0, (options.border ? 2 : 1) * (t ? 1 : -1))
  clearScreenDown()
}

const inscribe: Action<FirstLevel> = (item, options, {console : {inscribe, moveCursor}}) => {
  setTimeout(() => {
    moveCursor(3);
    inscribe('Nope')
    moveCursor(-3);
  })
}

const options: Options = {
  header: 'Test menu',
  border: true,
  designId: 20,
  // pageSize: 3
}

const loop = () =>
menu<FirstLevel>([
  { hotkey: '1', title: 'One' },
  { hotkey: '2', title: 'Two' },
  { hotkey: '3', title: 'Three', selected: true },
  { hotkey: '4', title: 'Four', actions: { 39: inscribe }, helpMessage: 'Press 🠔/🠖 and watch!' },
  { separator: true },
  { hotkey: '9', title: 'Do something else+H...', cascade: true },
  { hotkey: '0', title: 'Do something else-H...', cascade: true },
  { separator: true },
  { hotkey: 'D', title: designTitle, prevent: true, actions: { 37: design(-1), 39: design(+1) }, helpMessage: 'Use 🠔/🠖 to switch Design.' },
  { hotkey: 'H', title: 'Switch header 🠔/🠖', prevent: true, actions: { 37: header, 39: header }, helpMessage: 'Use 🠔/🠖 to switch Header.' },
  { hotkey: 'B', title: 'Switch border 🠔/🠖', prevent: true, actions: { 37: border, 39: border }, helpMessage: 'Use 🠔/🠖 to switch Border.' },
  { hotkey: 'C', title: 'Clear Console', helpMessage: '' },
  { hotkey: 'X', title: 'Exit loop', helpMessage: '' },
], options).then<SecondLevel>(item => {

  if (!item) {
    return null
  } else if(!item.cascade) {
    return item
  } else {
    console.log('You chose: ' + JSON.stringify(item))
    return menu<SecondLevelItem>(
      ['a','b','c','d','e','f','g','h','i','j']
        .map(hotkey => ({
          hotkey,
          title: 'Item ' + hotkey.toUpperCase(),
          subitem: true,
        })),
      {
        ...options,
        border: true,
        pageSize: 5,
        ...item.hotkey === '9' && {header:  'Another menu'} || {header: undefined}
      }
    )
  }
}).then(item => {
  if (item) {
    console.log('You chose: ' + JSON.stringify(item))
    if (item.hotkey === 'C') console.clear()
    if (item.hotkey === 'X') return menu([{ title: 'Stay' }, { title: 'Exit', hotkey: 'X', helpMessage: 'Choose Exit and then press Ctrl+C.' }], {helpMessage: ''});
  } else {
    console.log('You cancelled the menu.')
  }
  return item
}).then(item => {
  if (item?.hotkey === 'X') return;
  return IS_DEV && loop()
})

loop()
