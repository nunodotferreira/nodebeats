/**
 * Created by lakhe on 3/28/16.
 */
(function(){
    'use strict';

    var mailHelper = function(){

        var Promise = require("bluebird"),
            nodemailer = Promise.promisifyAll(require('nodemailer')),
            mailGunTransport = require('nodemailer-mailgun-transport'),
            mandrillTransport = require('nodemailer-mandrill-transport'),
            postmark = require("postmark"),
            sendGridTransport = require('nodemailer-sendgrid-transport'),
            sesTransport = require('nodemailer-ses-transport'),
            messageConfig = require('../configs/api.message.config'),
            emailServiceController = require('../controllers/email.service.server.controller')();

        var ConfigureEmailServer = function(req, next){
            try {
                var mailTransport = '';
                var opts = '';

                if(req.mailService) {
                    switch(req.mailService.serviceProviderType) {
                        case "amazon" :
                            opts = {
                                accessKeyId: req.mailService.api_Key,
                                secretAccessKey: req.mailService.api_Secret,
                                rateLimit: req.mailService.rateLimit // do not send more than 5 messages in a second
                            };
                            mailTransport = nodemailer.createTransport(sesTransport(opts));
                            break;
                        case "mailgun" :
                            opts = {
                                auth: {
                                    api_key: req.mailService.api_Key,
                                    domain: req.mailService.domain
                                }
                            };
                            mailTransport = nodemailer.createTransport(mailGunTransport(opts));
                            break;
                        case "mandrill" :
                            opts = {
                                auth: {
                                    apiKey: req.mailService.api_Key
                                }
                            };
                            mailTransport = nodemailer.createTransport(mandrillTransport(opts));
                            break;
                        case "normal" :
                            opts = {
                                host: req.mailService.host,
                                port: req.mailService.port,
                                secure: req.mailService.secure, // use SSL
                                auth: {
                                    user: req.mailService.authUserName,
                                    pass: req.mailService.authPassword
                                }
                            };
                            mailTransport = nodemailer.createTransport(opts);
                            break;
                        case "postmark" :
                            mailTransport = new postmark.Client(req.mailService.api_Key);
                            break;
                        case "sendgrid" :
                            opts = {
                                auth: {
                                    api_key: req.mailService.api_Key
                                }
                            };
                            mailTransport = nodemailer.createTransport(sendGridTransport(opts));
                            break;
                    }
                    return mailTransport;
                }
            }
            catch(err) {
                return  next(err);
            }
        };

        var GetEmailServerConfigurations = function(req, mailData, attachment, next) {

            return new Promise(function(resolve, reject) {
                emailServiceController.getMailServiceConfig()
                    .then(function(emailServiceConfig){
                        if(emailServiceConfig){
                            req.mailService = emailServiceConfig;
                            var mailer = ConfigureEmailServer(req, next);
                            //For checking if mailer service provider is postmark since
                            // the mailData format is different for postmark than others
                            if(mailer.options){
                                var mailServiceHost = mailer.options.requestHost;
                                if(mailServiceHost.indexOf('postmark')){
                                    var mailOpts = {
                                        "From": emailServiceConfig.api_User,
                                        "To": mailData.to,
                                        "Subject": mailData.subject,
                                        "TextBody": mailData.text,
                                        "HtmlBody": mailData.html
                                    };
                                    if(attachment){
                                        mailOpts.Attachments = mailData.attachments;
                                    }
                                    mailData = {};
                                    mailData = mailOpts;
                                }
                                return mailer.sendEmail(mailData);
                            }
                            else{
                                return mailer.sendMail(mailData);
                            }
                        } else{
                            reject(messageConfig.emailService.notFound);
                        }
                    })
                    .then(function(resData){
                        resolve(resData);
                    })
                    .catch(function(err){
                        reject(err);
                    });
            });
        };

        var sendEmailWithAttachment = function(req, mailData, next){
            var mailOptions = {
                from: mailData.fromEmail, // sender address
                to: mailData.toEmail, // list of receivers
                subject: mailData.subject, // Subject line
                text: mailData.textMessage, // plaintext body
                html: mailData.htmlTemplateMessage, // html body
                attachments:mailData.attachments
            };
            return GetEmailServerConfigurations(req, mailOptions, true, next);
        };

        var sendEmailWithNoAttachment = function(req, mailData, next){
            var mailOptions = {
                from: mailData.fromEmail, // sender address
                to: mailData.toEmail, // list of receivers
                subject: mailData.subject, // Subject line
                text: mailData.textMessage, // plaintext body
                html: mailData.htmlTemplateMessage // html body
            };
            return GetEmailServerConfigurations(req, mailOptions, false, next);
        };

        return{
            sendEmailWithAttachment : sendEmailWithAttachment,
            sendEmailWithNoAttachment : sendEmailWithNoAttachment
        };
    };

    module.exports = mailHelper;

})();