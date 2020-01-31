// A simple interactive console app to test the console-menu module.

import menu, { Item, SeparatorItem, BaseItem } from './console-menu'

const IS_DEV = process.env.NODE_ENV === 'development'

if (IS_DEV) console.clear()

interface FirstLevelItem extends BaseItem {
  cascade?: boolean
}

type FirstLevel = FirstLevelItem | SeparatorItem


interface SecondLevelItem extends BaseItem {
  subitem: true
}

type SecondLevel = FirstLevel | SecondLevelItem | null

const loop = () =>
menu<FirstLevel>([
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
}).then<SecondLevel>(item => {

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
        header: 'Another menu',
        border: true,
        pageSize: 5,
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
