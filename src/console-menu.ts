import os from 'os'
import readline from 'readline'
import ioHook from 'iohook'
// /* keypress */ import keypress from 'keypress'

import getTableString from './tablesDesigns'
import type { Direction } from 'tty'


declare interface IOHookKeyEvent {
  shiftKey: boolean
  altKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  keycode: number
  rawcode: number
  type: 'keyup' | 'keydown' // https://wilix-team.github.io/iohook/usage.html#available-events
  char: string // calculated, String.fromCharCode(rawcode)
}

export type Action = (Item: BaseItem, options: DefinedOptions) => void

export interface BaseItem {
  title: string       // Item title text
  hotkey?: string     // (character): Unique item hotkey must be a single constter, number, or other character. If omitted, the item is only selectable via arrow keys + Enter
  selected?: boolean  // True if this item should initially selected. If unspecified then the first item is initially selected
  separator?: false   // See SeparatorItem
  helpMessage?: string// Message text to show under the menu - will override options.helpMessage
  prevent?: boolean   // Option can't be confirmed - usefull when custom key actions are defined
  actions?: { [key: number]: Action } // Additional keys can be mapped when an option is selected
  [key: string]: any  // Items may have additional user-defined properties, which will be included in the returned result
}

export interface SeparatorItem {
  separator: true     // If true, this is a separator item that inserts a blank line into the menu
  [key: string]: any  // All additional properties are ignored on separator items
}

export type Item = BaseItem | SeparatorItem

export interface Options {
  header?: string       // Header text for the menu
  border?: boolean      // True to draw a border around the menu. False for a simpler-looking menu
  pageSize?: number     // Omitting this value (or specifying 0) disables scrolling. Max number of items to show at a time. Additional items cause the menu to be scrollable
  helpMessage?: string  // Message text to show under the menu, can be overriden by an item.helpMessage
  showKeypress?: boolean// Shows keypress information
  designString?: string // A table design, exactly 25 characters long. See tablesDesigns.ts/reference table
  designId?: number     // ID of a table design from tableDesigns.ts, default=1
}

interface DefinedOptions extends Options {
  pageSize: number
  helpMessage: string
  designId: number
}

function assert<T>(a: any): asserts a is T { }


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
export default async function menu<TItem extends Item>(items: TItem[], options: Options = {}): Promise<TItem | null> {

  if (!items || !Array.isArray(items) || items.length < 1) {
    throw new TypeError('A nonempty Items array is required.')
  }

  options.pageSize = options.pageSize ?? 0
  options.helpMessage = options.helpMessage ?? 'Type a hotkey or use Down/Up arrows then Enter to choose an item.'
  options.designId = options.designId || 1
  options.showKeypress = true
  assert<DefinedOptions>(options)

  /* Begin */

  const count = items.length
  let currentIndex = items.findIndex(item => item.selected)
  if (currentIndex === -1) {
    currentIndex = items.findIndex(item => !item.separator)
  }

  let scrollOffset = 0
  printMenu(items, options, currentIndex, scrollOffset)

  return new Promise((resolve, reject) => {
    process.stdin.setRawMode(true) // to capture CTRL+C
    setTimeout(() => process.stdin.setRawMode(true))
    // /* keypress */ process.stdin.resume() // Begin reading from stdin so the process does not exit.

    // /* keypress */ keypress(process.stdin) // enhance with 'keypress' event
    // /* keypress */ process.stdin.on('keypress', handleMenuKeypress)

    ioHook.on('keydown', handleMenuKeypress)
    ioHook.start()

    function handleMenuKeypress(key: IOHookKeyEvent) {
      setChar(key)
      menuAction(key)
    }

    const menuAction = (key: IOHookKeyEvent) => {
      let currentItem: TItem = items[currentIndex]

      let selection: TItem | undefined
      if (isEnter(key)) {
        selection = currentItem
      } else if /* is hotkey */ (!isCancelCommand(key)) {
        selection = items.find(item => item?.hotkey === key)
          || items.find(item => item?.hotkey?.toLowerCase() === key.char.toLowerCase())
      }

      /* Resolve if final */
      if ((selection && !isPrevented(selection)) || isCancelCommand(key)) {
        ioHook.off('keydown', handleMenuKeypress)
        // /* keypress */ process.stdin.pause()
        // /* keypress */ process.stdin.off('keypress', handleMenuKeypress)
        resetCursor(options, currentIndex, scrollOffset)
        readline.clearScreenDown(process.stdout)
        ioHook.stop()
        setTimeout(() => process.stdin.setRawMode(false))
        // process.stdin.setRawMode(false)
        return resolve(selection)
      }

      /* Find newIndex */
      let newIndex: number | undefined
      if (selection) {
        newIndex = items.indexOf(selection)
      } else {
        if (isUpCommand(key) && currentIndex > 0) {
          newIndex = currentIndex - 1
          while (newIndex >= 0 && items[newIndex].separator) newIndex--
        } else if (isDownCommand(key) && currentIndex < count - 1) {
          newIndex = currentIndex + 1
          while (newIndex < count && items[newIndex].separator) newIndex++
        } else if (isPageUpCommand(key) && currentIndex > 0) {
          newIndex = (options.pageSize ? Math.max(0, currentIndex - options.pageSize) : 0)
          while (newIndex < count && items[newIndex].separator) newIndex++
        } else if (isPageDownCommand(key) && currentIndex < count - 1) {
          newIndex = (options.pageSize ? Math.min(count - 1, currentIndex + options.pageSize) : count - 1)
          while (newIndex >= 0 && items[newIndex].separator) newIndex--
        } else if (isGoToFirstCommand(key) && currentIndex > 0) {
          newIndex = 0
          while (newIndex < count && items[newIndex].separator) newIndex++
        } else if (isGoToLastCommand(key) && currentIndex < count - 1) {
          newIndex = count - 1
          while (newIndex >= 0 && items[newIndex].separator) newIndex--
        } else {
          /* debug */
          if (options.showKeypress) {
            false // map remaining special keys
              || isLeftCommand(key)
              || isRightCommand(key)
          }
        }
      }

      if (hasActions(currentItem)) {
        currentItem.actions[key.rawcode]?.(currentItem, options)
      }

      /* Redraw menu with new selection */
      if (newIndex !== undefined && newIndex >= 0 && newIndex < count) {
        resetCursor(options, currentIndex, scrollOffset)

        currentIndex = newIndex

        // Adjust the scroll offset when the selection moves off the page.
        if (currentIndex < scrollOffset) {
          scrollOffset = (isPageUpCommand(key)
            ? Math.max(0, scrollOffset - options.pageSize) : currentIndex)
        } else if (options.pageSize && currentIndex >= scrollOffset + options.pageSize) {
          scrollOffset = (isPageDownCommand(key)
            ? Math.min(count - options.pageSize, scrollOffset + options.pageSize)
            : currentIndex - options.pageSize + 1)
        }
        printMenu(items, options, currentIndex, scrollOffset, key)
      } else if (options.showKeypress) {
        resetCursor(options, currentIndex, scrollOffset)
        printMenu(items, options, currentIndex, scrollOffset, key)
      }
    }
  })
}

const setChar = (key: IOHookKeyEvent, char = String.fromCharCode(key.rawcode)) => (key.char = char, key)

const isEnter             = (key: IOHookKeyEvent) => key.rawcode === 13 && setChar(key, '↵')
const isLeftCommand       = (key: IOHookKeyEvent) => key.rawcode === 37 && setChar(key, '🠔')
const isUpCommand         = (key: IOHookKeyEvent) => key.rawcode === 38 && setChar(key, '🠕')
const isRightCommand      = (key: IOHookKeyEvent) => key.rawcode === 39 && setChar(key, '🠖')
const isDownCommand       = (key: IOHookKeyEvent) => key.rawcode === 40 && setChar(key, '🠗')
const isPageUpCommand     = (key: IOHookKeyEvent) => key.rawcode === 33 && setChar(key, '⭱')
const isPageDownCommand   = (key: IOHookKeyEvent) => key.rawcode === 34 && setChar(key, '⭳')
const isGoToLastCommand   = (key: IOHookKeyEvent) => key.rawcode === 35 && setChar(key, '⭲')
const isGoToFirstCommand  = (key: IOHookKeyEvent) => key.rawcode === 36 && setChar(key, '⭰')
const isCancelCommand     = (key: IOHookKeyEvent) => (key.rawcode === 27 /* ESC */ || (key.ctrlKey && key.rawcode == 67 /* C */)) && setChar(key, 'ESC')

const isPrevented         = <TItem extends Item>(item?: TItem): boolean => item?.prevent
const hasActions          = <TItem extends Item>(item?: TItem): item is ItemWithActions<TItem> => !!item?.actions

type ItemWithActions<T extends Item> = T & { actions: T['actions'] }

function resetCursor(options: DefinedOptions, selectedIndex: number, scrollOffset: number) {
  readline.moveCursor(process.stdout, -3,
    - (options.header ? 1 : 0)
    - (options.border ? (options.header ? 2 : 1) : 0)
    - selectedIndex + scrollOffset
  )
}

const repeat = (s, n) => Array(n + 1).join(s)

function write(str: string, clearDirection: Direction = 1) {
  process.stdout.clearLine(clearDirection)
  process.stdout.write(str)
}

function writeln(str: string, clearDirection: Direction = 0) {
  write(str + os.EOL, clearDirection)
}

function printMenu(items: Item[], options: DefinedOptions, selectedIndex: number, scrollOffset: number, key?: IOHookKeyEvent) {
  const {
    header: HEADER,
    border: HAS_BORDER,
    pageSize,
    designId,
    designString: [
      // see tablesDesigns.ts for reference
      A,H, ,K,B,
      I,O,o,M,J,
      V,Y,y, , ,
      ,X,x, , ,
      C,P,p,L,D,
    ] = getTableString(designId),
  } = options

  const NO_HOTKEY = '*'

  const HH = H+H
  const OO = O+o
  const PP = P+p

  const N = os.EOL
  const S = ' '
  const V_ = (HAS_BORDER ? V + S : S)
  const _V = (HAS_BORDER ? S + V : '')

  /* Find position in scrollable list */

  const scrollEnd = pageSize
    ? Math.min(items.length, scrollOffset + pageSize)
    : items.length

  const HAS_SCROLL_TOP = pageSize && scrollOffset > 0
  const HAS_SCROLL_BOT = pageSize && scrollEnd < items.length


  /* Find longest row */
  let width = 0
  for (let i = 0; i < items.length; i++) {
    if (items[i].title && 4 + items[i].title.length > width) {
      width = 4 + items[i].title.length
    }
  }
  if (HEADER && HEADER.length > width) {
    width = HEADER.length
  }

  /* Top border */
  if (HAS_BORDER) {
    if (!HEADER && HAS_SCROLL_TOP) {
      writeln(A+HH+OO + repeat(H, width - 2) + B)
    } else {
      writeln(A + repeat(H, width + 2) + B)
    }
  }

  /* Header + header bottom border */
  if (HEADER) {
    writeln(V_ + HEADER + repeat(S, width - HEADER.length) + _V)
    if (HAS_BORDER) {
      if (HAS_SCROLL_TOP) {
        writeln(I+HH+OO + repeat(H, width - 2) + J)
      } else {
        writeln(I + repeat(H, width + 2) + J)
      }
    }
  }

  /* Write all Items */
  for (let i = scrollOffset; i < scrollEnd; i++) {
    let item = items[i]
    if (item.separator) {
      writeln(V_ + repeat(S, width) + _V)
    } else {
      const hotkey = item.hotkey ?? NO_HOTKEY
      const title = item.title
      const label = i === selectedIndex ? X+hotkey+x :  Y+hotkey+y
      writeln(V_ + label + S + title + repeat(S, width - title.length - 4) + _V)
    }
  }

  /* Bottom border */
  if (HAS_BORDER) {
    if (HAS_SCROLL_BOT) {
      writeln(C+HH+PP + repeat(H, width - 2) + D)
    } else {
      writeln(C + repeat(H, width + 2) + D)
    }
  }

  /* Help message */
  write(items[selectedIndex].helpMessage ?? options.helpMessage)

  /* Key press diagnostic window */
  if (options.showKeypress) {
    write(N + N)

    console.debug('.' + repeat('-', 62) + '.')
    console.debug('| char | shift | ctrl  | alt   | meta  | key   | raw | type    |')
    if (key) {
      console.debug(
          '|', key.char.padStart(4, ' ')
        , '|'.padEnd(6 - l(key.shiftKey), ' '), key.shiftKey
        , '|'.padEnd(6 - l(key.ctrlKey), ' '),  key.ctrlKey
        , '|'.padEnd(6 - l(key.altKey), ' '),   key.altKey
        , '|'.padEnd(6 - l(key.metaKey), ' '),  key.metaKey
        , '|'.padEnd(6 - l(key.keycode), ' '),  key.keycode
        , '|'.padEnd(4 - l(key.rawcode), ' '),  key.rawcode
        , '|'.padEnd(7 - l(key.type), ' '),     key.type
        , '|')
    } else {
      console.debug('|' + repeat(' ', 62) + '|')
    }
    console.debug('\'' + repeat('-', 62) + '\'')
  }

  readline.moveCursor(process.stdout,
    - options.helpMessage.length + V_.length + 2
    ,
    - (HAS_BORDER ? 1 : 0)
    - (scrollEnd - scrollOffset)
    + selectedIndex - scrollOffset
    - (options.showKeypress ? 6 : 0)
  )
  process.stdout.write('\x1b[?25l') // hide cursor
}

const l = v => v.toString().length
