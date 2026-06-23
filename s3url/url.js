const AWS = require('aws-sdk');

const s3 = new AWS.S3();

const BUCKET = process.env.BUCKET_NAME;

exports.handler = async (event) => {

    try {

        const imageId = event.pathParameters.id;

        // Example:
        // hd/passport.jpeg
        const key = `hd/${imageId}`;

        // Generate signed URL
        const signedUrl = s3.getSignedUrl('getObject', {
            Bucket: BUCKET,
            Key: key,
            Expires: 900 // 15 minutes
        });

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                imageId,
                expiresIn: "15 minutes",
                url: signedUrl
            })
        };

    } catch (error) {

        console.error(error);

        return {
            statusCode: 500,
            body: JSON.stringify({
                error: "Failed to generate signed URL"
            })
        };
    }
};