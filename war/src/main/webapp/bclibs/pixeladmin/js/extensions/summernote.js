!function (e, a) {
    if ("function" == typeof define && define.amd) define(["jquery", "px-libs/summernote"], a); else if ("undefined" != typeof exports) a(require("jquery"), require("px-libs/summernote")); else {
        a(e.jquery, e.summernote), e.summernote = {exports: {}}.exports
    }
}(this, function (e) {
    "use strict";
    !function (e) {
        if (!e.summernote) throw new Error("summernote.js required.");
        var a = e.summernote.options.icons;
        e.summernote.options = e.extend(e.summernote.options, {
            defaultIcons: a,
            icons: {
                align: "fa fa-align-left",
                alignCenter: "fa fa-align-center",
                alignJustify: "fa fa-align-justify",
                alignLeft: "fa fa-align-left",
                alignRight: "fa fa-align-right",
                indent: "fa fa-indent",
                outdent: "fa fa-outdent",
                arrowsAlt: "fa fa-arrows-alt",
                bold: "fa fa-bold",
                caret: "fa fa-caret-down",
                circle: "fa fa-circle-o",
                close: "fa fa-close",
                code: "fa fa-code",
                eraser: "fa fa-eraser",
                font: "fa fa-font",
                frame: "fa fa-",
                italic: "fa fa-italic",
                link: "fa fa-link",
                unlink: "fa fa-unlink",
                magic: "fa fa-magic",
                menuCheck: "fa fa-check",
                minus: "fa fa-minus",
                orderedlist: "fa fa-list-ol",
                pencil: "fa fa-pencil",
                picture: "fa fa-picture-o",
                question: "fa fa-question",
                redo: "fa fa-repeat",
                square: "fa fa-square-o",
                strikethrough: "fa fa-strikethrough",
                subscript: "fa fa-subscript",
                superscript: "fa fa-superscript",
                table: "fa fa-table",
                textHeight: "fa fa-text-height",
                trash: "fa fa-trash",
                underline: "fa fa-underline",
                undo: "fa fa-undo",
                unorderedlist: "fa fa-list-ul",
                video: "fa fa-video-camera"
            }
        }), e.summernote.options.modules = e.extend(e.summernote.options.modules, {
            fullscreen: function (a) {
                var t = a.layoutInfo.editor, f = a.layoutInfo.toolbar, n = a.layoutInfo.editable,
                    i = a.layoutInfo.codable, o = e(window), s = e("html, body");
                this.toggle = function () {
                    function e(e) {
                        n.css("height", e.h), i.css("height", e.h), i.data("cmeditor") && i.data("cmeditor").setsize(null, e.h)
                    }

                    t.toggleClass("fullscreen"), this.isFullscreen() ? (n.data("orgHeight", n.css("height")), o.on("resize.px.summernote", function () {
                        e({h: o.height() - f.outerHeight()})
                    }).trigger("resize"), s.addClass("summernote-fullscreen")) : (o.off("resize.px.summernote"), e({h: n.data("orgHeight")}), s.removeClass("summernote-fullscreen")), a.invoke("toolbar.updateFullscreen", this.isFullscreen())
                }, this.isFullscreen = function () {
                    return t.hasClass("fullscreen")
                }
            }
        })
    }(function (e) {
        return e && e.__esModule ? e : {default: e}
    }(e).default)
});