// A simple interactive console app to test the console-menu module.

import menu, { Item, SeparatorItem, BaseItem } from './console-menu'

if (process.env.NODE_ENV === 'dev') console.clear()

interface FirstLevelItem extends BaseItem {
  cascade?: boolean
}

type FirstLevel = FirstLevelItem | SeparatorItem


interface SecondLevelItem extends BaseItem {
  subitem: true
}

type SecondLevel = FirstLevel | SecondLevelItem | null

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
], {
  header: 'Test menu',
  border: true,
}).then<SecondLevel>(item => {

  console.debug('item', item)

  if (!item) {
    return null
  } else if(!item.cascade) {
    return item
  } else {
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
  console.debug('nextItem', item)
  if (item) {
    console.log('You chose: ' + JSON.stringify(item))
  } else {
    console.log('You cancelled the menu.')
  }
})
