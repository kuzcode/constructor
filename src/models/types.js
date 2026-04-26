/**
 * @typedef {Object} ShopContacts
 * @property {string} phone
 * @property {string} address
 * @property {string} email
 * @property {string} tgChannel
 * @property {string} tgDm
 * @property {string} instagram
 */

/**
 * @typedef {Object} ShopCategory
 * @property {string} id
 * @property {string|null} parentId
 * @property {string} name
 */

/**
 * @typedef {Object} ShopProduct
 * @property {string} id
 * @property {string|null} categoryId
 * @property {string} name
 * @property {string} description
 * @property {number} price
 * @property {string[]} imageFileIds
 */

/**
 * @typedef {Object} ShopPayload
 * @property {number} styleId
 * @property {string} name
 * @property {string} description
 * @property {ShopContacts} contacts
 * @property {ShopCategory[]} categories
 * @property {ShopProduct[]} products
 */

/**
 * @typedef {'text'|'image'|'button'} FreeBlockType
 */

/**
 * @typedef {Object} TextBlock
 * @property {'text'} type
 * @property {string} id
 * @property {'left'|'center'|'right'} align
 * @property {'heading'|'subheading'|'medium'|'body'|'small'} textVariant
 * @property {string} color
 * @property {string} content
 */

/**
 * @typedef {Object} ImageBlock
 * @property {'image'} type
 * @property {string} id
 * @property {string} fileId
 */

/**
 * @typedef {Object} LinkButtonAction
 * @property {'link'} kind
 * @property {string} url
 */

/**
 * @typedef {Object} VarButtonAction
 * @property {'variable'} kind
 * @property {string} variableId
 */

/**
 * @typedef {Object} ButtonBlock
 * @property {'button'} type
 * @property {string} id
 * @property {string} label
 * @property {string} bgColor
 * @property {string} textColor
 * @property {LinkButtonAction|VarButtonAction} action
 */

/**
 * @typedef {TextBlock|ImageBlock|ButtonBlock} FreeBlock
 */

/**
 * @typedef {Object} FreeVariable
 * @property {string} id
 * @property {string} name
 * @property {'number'|'text'} varType
 * @property {string} initialValue
 */

/**
 * @typedef {Object} BgColor
 * @property {'color'} type
 * @property {string} color
 */

/**
 * @typedef {Object} BgGradient
 * @property {'gradient'} type
 * @property {string} from
 * @property {string} to
 * @property {number} angle
 */

/**
 * @typedef {Object} BgImage
 * @property {'image'} type
 * @property {string} fileId
 * @property {'fixed'|'parallax'} mode
 */

/**
 * @typedef {Object} FreeSettings
 * @property {BgColor|BgGradient|BgImage} background
 */

/**
 * @typedef {Object} FreePayload
 * @property {FreeBlock[]} blocks
 * @property {FreeVariable[]} variables
 * @property {FreeSettings} settings
 */

/**
 * @typedef {Object} MiniAppDoc
 * @property {string} [ownerId]
 * @property {'shop'|'free'} appType
 * @property {string} title
 * @property {string} slug
 * @property {boolean} published
 * @property {ShopPayload|null} [shopPayload]
 * @property {FreePayload|null} [freePayload]
 */

export {};
