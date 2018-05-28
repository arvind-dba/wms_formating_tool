'use strict';
const fs = require('fs');
const mysql = require('mysql');

function sqlTransaction(query, callback) {
    const connection = mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: 'asort2018',
        database: 'asort'
    });
    connection.connect();
    connection.query(query, callback);
    connection.end();
}


/**
 * A function to transform a JSON to WMS Format
 */
function convertToWMSFormat(done) {
    const wmsObj = {};

    fs.readFile('./sample.json', { encoding: "UTF-8" }, (err, data) => {
        if (err) return done(err, null);
        if (!data) return done("No data found", null);

        const dataObject = JSON.parse(data);
        if (dataObject.shipping[0].address) {
            wmsObj.pincode = dataObject.shipping[0].address.postal;
            wmsObj.delivery_city = dataObject.shipping[0].address.city;
            wmsObj.delivery_address = dataObject.shipping[0].address.address1 + dataObject.shipping[0].address.address2;
            wmsObj.customer_name = dataObject.shipping[0].address.fullName;
            wmsObj.delivery_pincode = dataObject.shipping[0].address.postal;
            wmsObj.delivery_state = dataObject.shipping[0].address.region;
            wmsObj.delivery_state_code = "";
        }
        if (dataObject.billing[0].address) {
            wmsObj.billing_address = dataObject.billing[0].address.address1 + dataObject.billing[0].address.address2; //Need to understand if it is address1 + address2
            wmsObj.city = dataObject.billing[0].address.city;
            wmsObj.state = dataObject.billing[0].address.region;
        }
        wmsObj.po_date = dataObject.createdAt;
        wmsObj.priority = "1";
        wmsObj.organisation_code = "DBA";
        wmsObj.warehouse = "NA";
        wmsObj.customer_code = dataObject.userId;
        wmsObj.sales_manager_code = "NA";
        wmsObj.brand = wmsObj.brand_code = "Ifazone";
        wmsObj.ref_order = wmsObj.po_no = dataObject._id;
        wmsObj.sales_manager_name = "NA";
        wmsObj.order_sku_detail = dataObject.items.map(item => ({
            article_no: item.variants._id,
            colour: item.variants.title,
            mrp: item.variants.price,
            sku_code: item.variants.sku,
            qty: item.quantity,
            size: item.variants.optionTitle,
            discription: item.product.description
        }));

        // Get Courier Detail
        let query = `select courier, awb_no 
        from courier_details, awb_courier_details
        where courier_details.pincode = ${wmsObj.delivery_pincode} AND courier_details.courier = awb_courier_details.courier_code AND awb_courier_details.order_no = null limit 1`;

        sqlTransaction(query, (error, results, fields) => {
            if (error) return done(error, null);
            wmsObj.transpoter_name = wmsObj.transporter_contact_person = results[0].courier || "NA";
            wmsObj.awb_no = results[0].awb_no || null;

            // UPDATE awb_courier_details
            query = `UPDATE awb_courier_details
            SET order_no = ${wmsObj.ref_order}
            WHERE courier = ${wmsObj.transpoter_name} AND order_no;`;

            sqlTransaction(query, (error, results, fields) => {
                console.log("Error: ", error, "Result: ", results);
                return done(null, wmsObj);
            });
        });
    });
}

convertToWMSFormat((err, data) => {
    if (err) return console.log(err);
    console.log('The object is: ', data);
});