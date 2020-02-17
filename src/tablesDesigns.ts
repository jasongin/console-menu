/**
 * @author Vítězslav Ackermann Ferko <qwerty@qry.me>
 *
 * Inspired by https://github.com/vdmeer/asciitable#grids
 * Unicode Box Drawing symbols https://graphemica.com/blocks/box-drawing
 *
 *
 * Each table design consists of 5 rows and 6 columns.
 * Ultimately, not all characters are needed, see the reference table below.
 *
 *
 * ! NOTE !
 * It is NECESSARY to use an unbreakable space at the end of each line
 * to prevent IDE from trimming the whitespaces and thus making uneven line lengths.
 * It can also be used to separate different designs vertically as all nbsp are removed when processed.
 * Here is an unbreakable space ready to be used :) ->" "
*/
`reference table
 ┏××┳━┓   A     K  h¹ B
 ┃ )┃×┃   v¹ Yy v²    v³
 ┣/\╋━┫   I  Oo M  h² J
 ┃[]┃×┃   v⁴ Xx v⁵    v⁶
 ┗\/┻━┛   C  Pp L  h³ D
options.tableString = "┏××┳━┓┃ )┃×┃┣/\╋━┫┃[]┃×┃┗\/┻━┛"
`/*
 h¹-h³ - horizontal line
 v¹-v⁶ - vertical line
 ABCD  - corners
 IJKLM - crosses
 Yy - unselected option decorators
 Xx - selected option decorators
 Oo - page up indicator
 Pp - page down indicator
 ×  - ignored
*/

const TABLE_WIDTH = 6
const TABLE_HEIGHT = 5
export const tables: string[] = (s => s.raw[0].replace(/ /g, '').split('\n').slice(1, -1))`
┌──┬─┐      ╭──┬─╮ 
│ )│ │  )   │ )│ │ 
├/\┼─┤ /\   ├/\┼─┤ 
│[]│ │ []   │[]│ │ 
└\/┴─┘ \/   ╰\/┴─╯ 
·  · ·+  + + 
  )     )    
·/\· ·+/\+ + 
 []    []    
·\/· ·+\/+ + 
.--+-.+--+-+┼──┼─┼╬══╬═╬╋━━╋━╋ 
| )| || )| |│ )│ │║ )║ ║┃ )┃ ┃ 
+/\+-++/\+-+┼/\┼─┼╬/\╬═╬╋/\╋━╋ 
|[]| ||[]| |│[]│ │║[]║ ║┃[]┃ ┃ 
'\/+-'+\/+-+┼\/┼─┼╬\/╬═╬╋\/╋━╋ 
.──┬─.╵──┬─╵╶──┬─╴ 
│ )│ ││ )│ ││ )│ │ 
├/\┼─┤├/\┼─┤├/\┼─┤ 
│[]│ ││[]│ ││[]│ │ 
'\/┴─'╷\/┴─╷╶\/┴─╴ 
╒══╤═╕╔══╦═╗┏━━┳━┓┏──┳─┓ 
│ )│ │║ )║ ║┃ )┃ ┃│ )│ │ 
╞/\╪═╡╠/\╬═╣┣/\╋━┫┢/\╈─┪ 
│[]│ │║[]║ ║┃[]┃ ┃│[]│ │ 
╘\/╧═╛╚\/╩═╝┗\/┻━┛┗\/┻─┛ 
┏──┳─┓┌────┐┌  ┬ ┐┌    ┐ 
│ )│ ││ )  │  )     )    
│/\│ ││/\  │├/\┼ ┤ /\    
│[]│ ││[]  │ []    []    
┗\/┻─┛└\/──┘└\/┴ ┘└\/  ┘ 
 ────  ════  ━━━━  
  )     )     )    
 /\    /\    /\    
 []    []    []    
 \/    \/    \/    
                   
│ )│ │║ )║ ║┃ )┃ ┃ 
│/\│ │║/\║ ║┃/\┃ ┃ 
│[]│ │║[]║ ║┃[]┃ ┃ 
 \/    \/    \/    
`

// Count table designs ---------------------------------------------------------

let TABLE_COUNT = 0

for (let i = 0; i < tables.length; i += TABLE_HEIGHT) {
  const row = tables[i]
  TABLE_COUNT += row.length / TABLE_WIDTH
}

// -----------------------------------------------------------------------------

export default function getTableString(ix: number): string {
  if (ix > TABLE_COUNT || ix < 1) throw new RangeError(`There are ${TABLE_COUNT} tables available. (#${ix})`)

  const tableIndex = (ix - 1) * TABLE_WIDTH

  let rest = 0
  let row = 0
  let column = 0

  while (rest < tableIndex) {
    const rowLength = tables[row].length

    if ((rest + rowLength - TABLE_WIDTH) < tableIndex) {
      row += TABLE_HEIGHT
      rest += rowLength
    } else {
      column = tableIndex - rest
      break;
    }
  }

  let result = ''
  for (let i = 0; i < 5; i++) {
    result += tables[row+i].substr(column, TABLE_WIDTH)
  }

  return result
}
