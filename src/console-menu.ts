import os from 'os'
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
  keychar?: number
  // button?: number
  // clicks?: number
  // x?: number
  // y?: number
  char: string // calculated, String.fromCharCode(rawcode)
}

export type Action<T extends Item = Item> = (item: ItemWithActions<T>, options: DefinedOptions, internals: Internals) => void
type ItemWithActions<T extends Item> = T & { actions: T['actions'] }
export type Functional<T> = (item: Item, options: DefinedOptions, internals: Internals) => T
type Callable<T> = T | Functional<T>

export interface Item {
  title: Callable<string> // Item title text or a callback that returns text
  hotkey?: string         // (character): Unique item hotkey must be a single constter, number, or other character. If omitted, the item is only selectable via arrow keys + Enter
  selected?: boolean      // True if this item should initially selected. If unspecified then the first item is initially selected
  separator?: false       // See SeparatorItem
  helpMessage?: Callable<string> // Message text to show under the menu - will override options.helpMessage
  prevent?: boolean       // Option can't be confirmed - usefull when custom key actions are defined
  actions?: { [key: number]: Action } // Additional keys can be mapped when an option is selected
  [key: string]: any      // Items may have additional user-defined properties, which will be included in the returned result
}

interface SeparatorItem {
  separator: true     // If true, this is a separator item that inserts a blank line into the menu
  [key: string]: any  // All additional properties are ignored on separator items
}

export interface Options {
  header?: string       // Header text for the menu
  border?: boolean      // True to draw a border around the menu. False for a simpler-looking menu
  pageSize?: number     // Omitting this value (or specifying 0) disables scrolling. Max number of items to show at a time. Additional items cause the menu to be scrollable
  helpMessage?: Callable<string> // Message text to show under the menu, can be overriden by an item.helpMessage
  showKeypress?: boolean// Shows keypress information
  designString?: string // A table design, exactly 25 characters long. See tablesDesigns.ts/reference table
  designId?: number     // ID of a table design from tableDesigns.ts, default=1
}

interface DefinedOptions extends Options {
  pageSize: number
  helpMessage: string
  designId: number
}

interface Internals {
  console: {
    /* ATTENTION, you might need to wrap the call inside `setTimeout` if you don't see results. */
    write: typeof write
    writeln: typeof writeln
    inscribe: typeof inscribe
    moveCursor: (dx: number, dy?: number) => void
    clearLine: (direction?: Direction) => void
    clearScreenDown: () => void
  }
}

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
export default async function menu<TItem extends Item>(items: (TItem | SeparatorItem)[], options: Options = {}): Promise<TItem | null> {

  if (!items || !Array.isArray(items) || items.length < 1) {
    throw new TypeError('A nonempty Items array is required.')
  }

  options.pageSize = options.pageSize ?? 0
  options.helpMessage = options.helpMessage ?? 'Type a hotkey or use Down/Up arrows then Enter to choose an item.'
  options.designId = options.designId || 1
  options.showKeypress = true
  assert<DefinedOptions>(options)

  const internals: Internals = {
    console: consoleInternals
  }

  /* Begin */

  const count = items.length
  let currentIndex = items.findIndex(item => item.selected)
  if (currentIndex === -1) {
    currentIndex = items.findIndex(item => !item.separator)
  }

  let scrollOffset = 0
  printMenu(options, internals, items, currentIndex, scrollOffset)

  return new Promise((resolve, reject) => {
    process.stdin.setRawMode(true) // to capture CTRL+C
    setTimeout(() => process.stdin.setRawMode(true))
    // /* keypress */ process.stdin.resume() // Begin reading from stdin so the process does not exit.

    // /* keypress */ keypress(process.stdin) // enhance with 'keypress' event
    // /* keypress */ process.stdin.on('keypress', handleMenuKeypress)

    ioHook.on('keydown', handleMenuKeypress)
    ioHook.start()

    function handleMenuKeypress(key: IOHookKeyEvent) {
      setChar(key) // map char to rawCode for hotkey navigation
      menuAction(key)
    }

    const menuAction = (key: IOHookKeyEvent) => {
      let currentItem: TItem = items[currentIndex] as TItem

      /* Invoke actions before anything else */
      let actionInvoked = false
      if (hasActions(currentItem)) {
        currentItem.actions[key.rawcode]?.(currentItem, options, internals)
        actionInvoked = currentItem.actions[key.rawcode]
      }

      /* Begin */
      // With selection --------------------------------------------------------

      /* If Enter or Hotkey, make selection.. */
      let selection: TItem | undefined
      if (isEnter(key)) {
        selection = currentItem
      } else if /* is hotkey */ (!isCancelCommand(key)) {
        selection = items.find<TItem>((item): item is TItem => item?.hotkey === key)
          || items.find<TItem>((item): item is TItem => item?.hotkey?.toLowerCase() === key.char.toLowerCase())
      }

      /* ..and resolve with the selection. Cancel command also triggers this */
      if ((selection && !isPrevented(selection)) || isCancelCommand(key)) {
        ioHook.off('keydown', handleMenuKeypress)
        // /* keypress */ process.stdin.pause()
        // /* keypress */ process.stdin.off('keypress', handleMenuKeypress)
        resetCursor(options, currentIndex, scrollOffset)
        process.stdout.clearScreenDown()
        ioHook.stop()
        setTimeout(() => process.stdin.setRawMode(false))
        // process.stdin.setRawMode(false)
        return resolve(selection)
      }

      // Or key navigation -----------------------------------------------------

      /* If Key navigation, find the newIndex */
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

      // Draw menu -------------------------------------------------------------

      /* 1/3 Redraw menu with new selection */
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
        printMenu(options, internals, items, currentIndex, scrollOffset, key)
      }
      /* 2/3 OR redraw menu if Item.action was invoked */
      /* 3/3 OR for any key if keypress debug is enabled */
      else if (actionInvoked || options.showKeypress) {
        resetCursor(options, currentIndex, scrollOffset)
        return printMenu(options, internals, items, currentIndex, scrollOffset, key)
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

const isPrevented         = <TItem extends Item>(item?: TItem): boolean => !!item?.prevent

/* Type guards, assertions, predicates and checks */
function assert<T>(a: any): asserts a is T { }
function isType<T>(a: any, condition): a is T { return condition }

const isItem = (item?: any): item is Item => isType<Item>(item, item && !item.separator)
const hasActions = <TItem extends Item>(item?: TItem): item is ItemWithActions<TItem> => !!item?.actions
const isFunction = <T>(property: Callable<T>): property is Functional<T> => typeof property === 'function'
// **

function resetCursor(options: DefinedOptions, selectedIndex: number, scrollOffset: number) {
  process.stdout.moveCursor(-3,
    - (options.header ? 1 : 0)
    - (options.border ? (options.header ? 2 : 1) : 0)
    - selectedIndex + scrollOffset
  )
}

const repeat = (s, n) => Array(n + 1).join(s)

/* Clears line and writes */
function write(str: string, clearDirection: Direction = 1) {
  process.stdout.clearLine(clearDirection)
  process.stdout.write(str)
}

function writeln(str: string = '', clearDirection: Direction = 0) {
  write(str + os.EOL, clearDirection)
}

/* Writes in place and resets cursor position */
function inscribe(str: string) {
  const lines = str.split('\n')
  process.stdout.write(str)
  process.stdout.moveCursor(lines[lines.length - 1].length, lines.length - 1)
}

const consoleInternals: Internals['console'] = {
  write,
  writeln,
  inscribe,
  moveCursor: (dx, dy) => process.stdout.moveCursor(dx, dy),
  clearLine: (direction: Direction = 0) => process.stdout.clearLine(direction),
  clearScreenDown: () => process.stdout.clearScreenDown(),
}

// -----------------------------------------------------------------------------

function printMenu(options: DefinedOptions, internals: Internals, items: (Item | SeparatorItem)[], selectedIndex: number, scrollOffset: number, key?: IOHookKeyEvent) {
  const {
    header: HEADER,
    border: HAS_BORDER,
    pageSize,
    designId,
    designString: [
      // see tablesDesigns.ts for reference
      A  ,  ,  , K  , h1 , B  ,
      v1 , Y,y , v2 ,    , v3 ,
      I  , O,o , M  , h2 , J  ,
      v4 , X,x , v5 ,    , v6 ,
      C  , P,p , L  , h3 , D  ,
    ] = getTableString(designId),
  } = options

  const NO_HOTKEY = '*'

  const HH1 = h1+h1
  const HH2 = h2+h2
  const HH3 = h3+h3
  const OO = O+o
  const PP = P+p

  const S = ' '
  const V_ = (HAS_BORDER ? v4 + S  : S )
  const _V = (HAS_BORDER ? S  + v6 : '')

  /* Find position in scrollable list */

  const scrollEnd = pageSize
    ? Math.min(items.length, scrollOffset + pageSize)
    : items.length

  const HAS_SCROLL_TOP = pageSize && scrollOffset > 0
  const HAS_SCROLL_BOT = pageSize && scrollEnd < items.length

  /* Find longest row and Initialize callback values */
  let width = 0
  let titles = {}

  for (let i = 0; i < items.length; ++i) {
    let item = items[i]
    if (isItem(item)) {
      const title = titles[i] = isFunction(item.title) ? item.title(item, options, internals) : item.title

      if (4 + title.length > width) width = 4 + title.length
    }
  }
  if (HEADER && HEADER.length > width) {
    width = HEADER.length
  }

  /* Top border */
  if (HAS_BORDER) {
    if (HAS_SCROLL_TOP && !HEADER) writeln(A+HH1+OO + repeat(h1, width - 2) + B)
    else                           writeln(A        + repeat(h1, width + 2) + B)
  }

  /* Header row + Header bottom border */
  if (HEADER) {
    writeln(V_ + HEADER + repeat(S, width - HEADER.length) + _V)
    if (HAS_BORDER) {
      if (HAS_SCROLL_TOP) writeln(I+HH2+OO + repeat(h2, width - 2) + J)
      else                writeln(I        + repeat(h2, width + 2) + J)
    }
  }

  /* Write all Items */
  for (let i = scrollOffset; i < scrollEnd; ++i) {
    let item = items[i]
    if (item.separator) {
      writeln(V_ + repeat(S, width) + _V)
    } else {
      const hotkey = item.hotkey ?? NO_HOTKEY
      const bullet = i === selectedIndex ? X+hotkey+x : Y+hotkey+y
      writeln(V_ + bullet + S + titles[i] + repeat(S, width - titles[i].length - 4) + _V)
    }
  }

  /* Bottom border */
  if (HAS_BORDER) {
    if (HAS_SCROLL_BOT) writeln(C+HH3+PP + repeat(h3, width - 2) + D)
    else                writeln(C        + repeat(h3, width + 2) + D)
  }

  /* Help message */
  const item = items[selectedIndex] as Item // SeparatorItem can't be selected
  const helpMessage =
    item.helpMessage !== undefined && isFunction(item.helpMessage)
      ? item.helpMessage(item, options, internals)
      : item.helpMessage
  writeln(helpMessage ?? options.helpMessage)

  /* Key press diagnostic window */
  if (options.showKeypress) {
    const l = v => (v || 'undefined').toString().length

    writeln()
    writeln()

    writeln('.' + repeat('-', 74) + '.')
    writeln('| char | shift | ctrl  | alt   | meta  | key   | raw | keychar   | type    |')
    if (key) {
      process.stdout.clearLine(0)
      console.debug(
          '|', key.char.padStart(4, ' ')
        , '|'.padEnd(6 - l(key.shiftKey), ' '), key.shiftKey
        , '|'.padEnd(6 - l(key.ctrlKey), ' '),  key.ctrlKey
        , '|'.padEnd(6 - l(key.altKey), ' '),   key.altKey
        , '|'.padEnd(6 - l(key.metaKey), ' '),  key.metaKey
        , '|'.padEnd(6 - l(key.keycode), ' '),  key.keycode
        , '|'.padEnd(4 - l(key.rawcode), ' '),  key.rawcode
        , '|'.padEnd(10- l(key.keychar), ' '),  key.keychar
        , '|'.padEnd(7 - l(key.type), ' '),     key.type
        , '|')
    } else {
      writeln('|' + repeat(' ', 74) + '|')
    }
    writeln('\'' + repeat('-', 74) + '\'')
    process.stdout.moveCursor(0, -6)
  }

  process.stdout.moveCursor(V_.length + 1 ,
    -1 +
    - (HAS_BORDER ? 1 : 0)
    - (scrollEnd - scrollOffset)
    + selectedIndex - scrollOffset
  )

  // process.stdout.write('\x1b[?25l') // hide cursor
}

