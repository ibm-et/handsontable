import * as dom from './../../dom.js';
import * as helpers from './../../helpers.js';
import {EventManager} from './../../eventManager.js';
import {registerPlugin, getPlugin} from './../../plugins.js';
import BasePlugin from './../_base.js';

/**
 * @class CollapsibleColumns
 * @plugin CollapsibleColumns
 * @dependencies NestedHeaders HiddenColumns
 *
 * @description
 * Allows collapsing of headers with a defined colspan
 */
class CollapsibleColumns extends BasePlugin {

  constructor(hotInstance) {
    super(hotInstance);

    if (!this.hot.getSettings().collapsibleColumns) {
      return;
    }

    this.checkDependencies();

    this.settings = this.hot.getSettings().collapsibleColumns;

    this.hiddenColumnsPlugin = null;
    this.collapsedSections = {};

    this.bindHooks();
  }

  /**
   * Checks if all the needed dependencies are enabled
   *
   * @returns {Boolean}
   */
  checkDependencies() {
    if (!this.hot.nestedHeaders) {
      console.warn('You need to configure the Nested Headers plugin in order to use collapsible headers.');

      return false;
    }

    if (!this.hot.hiddenColumns) {
      console.warn('You need to configure the Nested Headers plugin in order to use collapsible headers.');

      return false;
    }
  }

  /**
   * Bind the HOT hooks
   */
  bindHooks() {
    this.hot.addHook('afterInit', () => this.onAfterInit());
    this.hot.addHook('afterGetColHeader', (col, TH) => this.onAfterGetColHeader(col, TH));
    this.hot.addHook('beforeOnCellMouseDown', (event, coords, TD) => this.onBeforeOnCellMouseDown(event, coords, TD));
  }

  onAfterInit() {
    this.hiddenColumnsPlugin = this.hot.getPlugin('hiddenColumns');
    this.columnHeaderLevelCount = this.hot.view.wt.getSetting('columnHeaders').length;
    this.nestedHeadersPlugin = this.hot.getPlugin('nestedHeaders');
  }

  /**
   * Generates the indicator element
   *
   * @param {Number} col
   * @param {HTMLElement} TH
   * @returns {HTMLElement}
   */
  generateIndicator(col, TH) {
    let divEl = document.createElement('DIV');
    let row = (-1) * TH.parentNode.parentNode.childNodes.length + Array.prototype.indexOf.call(TH.parentNode.parentNode.childNodes, TH.parentNode);

    dom.addClass(divEl, 'collapsibleIndicator');

    if (this.collapsedSections[row] && this.collapsedSections[row][col] === true) {
      dom.addClass(divEl, 'collapsed');
      dom.fastInnerText(divEl, '+');
    } else {
      dom.addClass(divEl, 'expanded');
      dom.fastInnerText(divEl, '-');
    }

    return divEl;
  }




  /**
   * Add the indicator to the headers
   *
   * @param {Number} col
   * @param {HTMLElement} TH
   */
  onAfterGetColHeader(col, TH) {
    if (TH.hasAttribute('colspan') && TH.getAttribute('colspan') > 1) {
      TH.querySelector('div:first-child').appendChild(this.generateIndicator(col, TH));
    }
  }

  /**
   * Indicator mouse event callback
   *
   * @param {Object} event
   * @param {Object} coords
   * @param {HTMLElement} TD
   */
  onBeforeOnCellMouseDown(event, coords, TD) {
    if (dom.hasClass(event.target, 'collapsibleIndicator')) {

      if (dom.hasClass(event.target, 'expanded')) {

        // mark section as collapsed
        if (!this.collapsedSections[coords.row]) {
          this.collapsedSections[coords.row] = [];
        }

        this.markSectionAs('collapsed', coords.row, coords.col, TD, true);

        this.toggleCollapsedSection(coords, TD, 'collapse');

      } else if (dom.hasClass(event.target, 'collapsed')) {

        this.markSectionAs('expanded', coords.row, coords.col, TD, true);

        this.toggleCollapsedSection(coords, TD, 'expand');
      }

      event.stopImmediatePropagation();
    }
  }

  /**
   * Mark (internally) a section as 'collapsed' or 'expanded' (optionally, also mark the 'child' headers)
   *
   * @param {String} state
   * @param {Number} row
   * @param {Number} col
   * @param {HTMLElement} TH
   * @param {Boolean} recursive
   */
  markSectionAs(state, row, col, TH, recursive) {
    if (!this.collapsedSections[row]) {
      this.collapsedSections[row] = [];
    }

    switch (state) {
      case 'collapsed':
        this.collapsedSections[row][col] = true;

        break;
      case 'expanded':
        this.collapsedSections[row][col] = void 0;

        break;
    }

    if (recursive) {
      let nestedHeadersColspans = this.hot.getSettings().nestedHeaders.colspan;
      let realColumnIndex = this.nestedHeadersPlugin.nestedColumnIndexToRealIndex(row, col);

      for (let i = realColumnIndex, colspan = parseInt(TH.getAttribute('colspan'), 10); i < realColumnIndex + colspan; i++) {
        let reversedIndex = this.columnHeaderLevelCount + row + 1;
        let lowerLevelColumnIndex = this.nestedHeadersPlugin.realColumnIndexToNestedIndex(row + 1, realColumnIndex);

        if (nestedHeadersColspans[reversedIndex] && nestedHeadersColspans[reversedIndex][lowerLevelColumnIndex] > 1) {
          let nextTH = this.hot.view.wt.wtTable.THEAD.childNodes[reversedIndex].childNodes[lowerLevelColumnIndex];

          this.markSectionAs(state, row + 1, lowerLevelColumnIndex, nextTH, true);
        }
      }
    }
  }

  isCollapsed(row, col) {
    return this.collapsedSections[row] && this.collapsedSections[row][col] === true;
  }

  /**
   * Collapse/Expand a section
   *
   * @param {Object} coords
   * @param {HTMLElement} TD
   * @param {String} action
   */
  toggleCollapsedSection(coords, TD, action) {
    let currentlyHiddenColumns = this.hiddenColumnsPlugin.settings;
    let TR = TD.parentNode;
    let THEAD = TR.parentNode;
    let headerLevel = THEAD.childNodes.length - Array.prototype.indexOf.call(THEAD.childNodes, TR) - 1;
    let colspanOffset = this.hot.getColspanOffset(coords.col, headerLevel);


    if (currentlyHiddenColumns === true) {
      currentlyHiddenColumns = [];
    } else {
      currentlyHiddenColumns = currentlyHiddenColumns.columns;
    }

    let columnArray = helpers.deepClone(currentlyHiddenColumns);

    switch (action) {
      case 'collapse':

        for (let i = 1, colspan = parseInt(TD.getAttribute('colspan'), 10); i < colspan; i++) {
          let colToHide = coords.col + colspanOffset + i;

          if (currentlyHiddenColumns.indexOf(colToHide) === -1) {
            columnArray.push(colToHide);
          }
        }

        break;
      case 'expand':

        for (let i = 1, colspan = parseInt(TD.getAttribute('colspan'), 10); i < colspan; i++) {
          let colToHide = coords.col + colspanOffset + i;
          let foundIndex = columnArray.indexOf(colToHide);

          if (foundIndex > -1) {
            columnArray.splice(foundIndex, 1);
          }
        }

        break;
    }


    this.hot.updateSettings({
      hiddenColumns: {
        columns: columnArray
      }
    });
  }
}

export {CollapsibleColumns};

registerPlugin('collapsibleColumns', CollapsibleColumns);