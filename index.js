const AWS = require('aws-sdk');
const sharp = require('sharp');
const exifParser = require('exif-parser');

const s3 = new AWS.S3();
const dynamodb = new AWS.DynamoDB.DocumentClient();

const DEST_BUCKET = process.env.dest_bucket;
const METADATA_TABLE = process.env.metadata_table;

exports.handler = async (event) => {

    console.log(JSON.stringify(event, null, 2));

    for (const sqsRecord of event.Records) {

        // Parse SQS body
        const body = JSON.parse(sqsRecord.body);

        // Ignore S3 test events
        if (body.Event === "s3:TestEvent") {
            console.log("Skipping test event");
            continue;
        }

        // Get actual S3 event
        const s3Event = body.Records[0];

        const bucket = s3Event.s3.bucket.name;

        // Decode filename properly
        const key = decodeURIComponent(
            s3Event.s3.object.key.replace(/\+/g, " ")
        );

        console.log("Bucket:", bucket);
        console.log("Key:", key);

        // Download original image
        const originalImage = await s3.getObject({
            Bucket: bucket,
            Key: key
        }).promise();

        const imageBuffer = originalImage.Body;

        // -----------------------------------
        // EXIF extraction
        // -----------------------------------

        let exifData = {};

        try {

            const parser = exifParser.create(imageBuffer);
            const result = parser.parse();

            exifData = result.tags || {};

            console.log("EXIF:", exifData);

        } catch (err) {

            console.log("No EXIF data found");

        }

        // -----------------------------------
        // image dimensions
        // -----------------------------------

        const metadata = await sharp(imageBuffer).metadata();

        console.log("Dimensions:", metadata.width, metadata.height);

        // -----------------------------------
        // resize images
        // -----------------------------------

        const sizes = [
            { name: "thumbnail", width: 100 },
            { name: "medium", width: 400 },
            { name: "hd", width: 1200 }
        ];

        const uploadedSizes = {};

        for (const size of sizes) {

            const resizedImage = await sharp(imageBuffer)
                .resize({ width: size.width })
                .jpeg()
                .toBuffer();

            const outputKey = `${size.name}/${key}`;

            await s3.putObject({
                Bucket: DEST_BUCKET,
                Key: outputKey,
                Body: resizedImage,
                ContentType: 'image/jpeg'
            }).promise();

            console.log(`Uploaded: ${outputKey}`);

            uploadedSizes[size.name] = outputKey;
        }

        // -----------------------------------
        // save metadata to db
        // -----------------------------------

        const item = {

            imageId: key,

            userId: "user42", // replace later with Cognito user

            uploadedAt: new Date().toISOString(),

            original: {
                width: metadata.width,
                height: metadata.height
            },

            sizes: uploadedSizes,

            fileInfo: {
                contentType: originalImage.ContentType,
                fileSize: originalImage.ContentLength,
                etag: originalImage.ETag
            },

            exif: {
                cameraMake: exifData.Make || "Unknown",
                cameraModel: exifData.Model || "Unknown",
                iso: exifData.ISO || null,
                takenAt: exifData.DateTimeOriginal || null
            }
        };

        await dynamodb.put({
            TableName: METADATA_TABLE,
            Item: item
        }).promise();

        console.log("Metadata saved to DynamoDB");
    }

    return {
        statusCode: 200,
        body: "Image processing complete"
    };
};