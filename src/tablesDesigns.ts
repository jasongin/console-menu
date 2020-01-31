/**
 * @author Vítězslav Ackermann Ferko <qwerty@qry.me>
 *
 * Inspired by https://github.com/vdmeer/asciitable#grids
 * Unicode Box Drawing symbols https://graphemica.com/blocks/box-drawing
 *
 *
 * Each table design consists of 5 rows and 5 columns.
 * Ultimately, not all characters are needed, see the reference table below.
 *
 *
 * ! NOTE !
 * It is NECESSARY to use an unbreakable space at the end of each line
 * to prevent IDE from trimming the whitespaces and thus making uneven line lengths.
 * It can also be used to separate different designs horizontally.
 * Here is an unbreakable space ready to be used :) ->" "
*/

`reference table
 ┏━─┳┓   AH KB - table body if header is off
 ┣/\╋┫   IOOMJ - table body if header is on
 ┃ )││   VYY
 │[]││    XX
 ┗\/┻┛   CPPLD
`/*
 ABCD - corners
 H - horizontal line
 V - vertical line
 IJKLM - crosses
 YY - unselected option decorators
 XX - selected option decorators
 OO - page up indicator
 PP - page down indicator
*/

export const tables: string[] = (s => s.raw[0].split(/ ?\n/).slice(1, -1))`
┌──┬┐ .--+. +--++ 
├/\┼┤ +/\++ +/\++ 
│ )││ | )|| | )|| 
│[]││ |[]|| |[]|| 
└\/┴┘ '\/+' +\/++ 
╒══╤╕╔══╦╗┏━━┳┓┌──┬┐ ┼──┼┼ ╋━━╋╋ 
╞/\╪╡╠/\╬╣┣/\╋┫┢/\╈┪ ┼/\┼┼ ╋/\╋╋ 
│ )││║ )║║┃ )┃┃│ )││ │ )││ ┃ )┃┃ 
│[]││║[]║║┃[]┃┃│[]││ │[]││ ┃[]┃┃ 
╘\/╧╛╚\/╩╝┗\/┻┛┗\/┻┛ ┼\/┼┼ ╋\/╋╋ 
┌───┐┌  ┬┐┌   ┐      
│/\ │├/\┼┤ /\   /\   
│ ) │  )    )    )   
│[] │ []   []   []   
└\/─┘└\/┴┘└\/ ┘ \/   
 ───  ─── ═════ ━━━━━ 
 /\   /\─ ═/\══ ━/\━━ 
  )    )    )     )   
 []   []   []    []   
 \/─  \/─ ═\/══ ━\/━━ 
                
│/\││ /\┼ │/\   
│ )││  )│ │ )   
│[]││ []│ │[]   
 \/   \/   \/   
`

// Count table designs ---------------------------------------------------------

const TABLE_WIDTH = 5
const TABLE_HEIGHT = 5

let TABLE_COUNT = 0

for (let i = 0; i < tables.length; i += TABLE_WIDTH) {
  const row = tables[i]
  TABLE_COUNT += row.length / TABLE_WIDTH
}

// -----------------------------------------------------------------------------

export default function getTableString(ix: number): string {
  if (ix > TABLE_COUNT || ix < 1) throw new RangeError(`There are ${TABLE_COUNT} tables available.`)

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
