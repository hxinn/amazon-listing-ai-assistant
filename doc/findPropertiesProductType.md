[TOC]
    
##### 简要描述

- 根据属性获取产品类型

##### 请求URL
- `POST` ：`/amazonCategorySpProductType/find/{properties}/productType`
  
##### 参数

- Param

| 参数名 | 必选 | 类型 | 说明 |
|:----:|:---:|:----:|:----:|
| properties | 是 | string | 属性key |

- Body

无

##### 请求示例 

POST /amazonCategorySpProductType/find/color/productType

##### 返回参数说明 

| 参数名 |   类型   |              说明               |
|:----:|:------:|:-----------------------------:|
| success |   boolean   |         状态码，true表示成功          |
| msg | string |             状态信息              |
| result | object |             返回结果              |
| result.{site} | string | 站点对应的产品类型，key为站点代码，value为产品类型 |

##### 返回示例 

{
    "success": true,
    "msg": "success",
    "result": {
        "US": "SHOES",
        "UK": "FOOTWEAR",
        "DE": "SCHUHE"
    }
}