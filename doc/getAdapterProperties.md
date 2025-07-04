[TOC]
    
##### 简要描述

- 获取需要适配的属性

##### 请求URL
- `GET` ：`/productTypeTemplateJsonAttr/getAdapterProperties`
  
##### 参数

- Param

无

- Body

无

##### 请求示例 

GET /productTypeTemplateJsonAttr/getAdapterProperties

##### 返回参数说明 

| 参数名 | 类型 | 说明 |
|:----:|:----:|:----:|
| success |   boolean   |         状态码，true表示成功          |
| msg | string | 状态信息 |
| result | array | 需要适配的属性列表 |

##### 返回示例 

{
    "success": true,
    "msg": "success",
    "result": [
        "color",
        "size",
        "material",
        "brand"
    ]
}