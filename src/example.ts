// A simple interactive console app to test the console-menu module.

import menu, { SeparatorItem, BaseItem, Action, Options } from './console-menu'

const IS_DEV = process.env.NODE_ENV === 'development'

if (IS_DEV) console.clear()

interface FirstLevelItem extends BaseItem {
  cascade?: boolean
  prevent?: boolean
  actions?: any
}

type FirstLevel = FirstLevelItem | SeparatorItem


interface SecondLevelItem extends BaseItem {
  subitem: true
}

type SecondLevel = FirstLevel | SecondLevelItem | null

const design = (increment: number): Action => (item, options) => {
  const [a = '', b = ''] = item.title.split(item.title.indexOf('/') > -1 ? '/' : ''+options.designId)

  options.designId += increment
  item.title = a + options.designId + b
}

const border: Action = (item, options) => {
  console.clear()
  options.border = !options.border
}

const header: Action = (item, options) => {
  console.clear()
  //@ts-ignore
  const t = options._header
  //@ts-ignore
  options._header = options.header
  options.header = t
}

const options: Options = {
  header: 'Test menu',
  border: true,
  // pageSize: 3
}

const loop = () =>
menu<FirstLevel>([
  { hotkey: '1', title: 'One' },
  { hotkey: '2', title: 'Two', selected: false },
  { hotkey: '3', title: 'Three' },
  { hotkey: '4', title: 'Four' },
  { separator: true },
  { hotkey: '9', title: 'Do something else+...', cascade: true },
  { hotkey: '0', title: 'Do something else...', cascade: true },
  { separator: true },
  { hotkey: 'D', title: 'Switch design 🠔/🠖', prevent: true, actions: { 37: design(-1), 39: design(+1) }, helpMessage: 'Use 🠔/🠖 to switch Design.' },
  { hotkey: 'B', title: 'Switch border 🠔/🠖', prevent: true, actions: { 37: border, 39: border }, helpMessage: 'Use 🠔/🠖 to switch Border.' },
  { hotkey: 'H', title: 'Switch header 🠔/🠖', prevent: true, actions: { 37: header, 39: header }, helpMessage: 'Use 🠔/🠖 to switch Header.' },
  { hotkey: 'C', title: 'Clear Console' },
  { hotkey: 'X', title: 'Exit loop' },
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
        border: true,
        pageSize: 5,
        ...item.hotkey === '9' && {header:  'Another menu'}
      }
    )
  }
}).then(item => {
  if (item) {
    console.log('You chose: ' + JSON.stringify(item))
    if (item.hotkey === 'C') console.clear()
    if (item.hotkey === 'X') return menu([{ title: 'Stay' }, { title: 'Exit', hotkey: 'X' }]);
  } else {
    console.log('You cancelled the menu.')
  }
  return item
}).then(item => {
  if (item?.hotkey === 'X') return;
  return IS_DEV && loop()
})

loop()
