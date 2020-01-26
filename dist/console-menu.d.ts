export interface BaseItem {
    title: string;
    hotkey?: string;
    selected?: boolean;
    separator?: false;
    [key: string]: any;
}
export interface SeparatorItem {
    separator: true;
    [key: string]: any;
}
export declare type Item = BaseItem | SeparatorItem;
export interface Options {
    header?: string;
    border?: boolean;
    pageSize?: number;
    helpMessage?: string;
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
export default function menu<TItem extends Item>(items: TItem[], options?: Options): Promise<TItem | null>;
