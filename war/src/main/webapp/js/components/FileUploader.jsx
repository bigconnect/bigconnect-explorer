/*
 * This file is part of the BigConnect project.
 *
 * Copyright (c) 2013-2020 MWARE SOLUTIONS SRL
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License version 3
 * as published by the Free Software Foundation with the addition of the
 * following permission added to Section 15 as permitted in Section 7(a):
 * FOR ANY PART OF THE COVERED WORK IN WHICH THE COPYRIGHT IS OWNED BY
 * MWARE SOLUTIONS SRL, MWARE SOLUTIONS SRL DISCLAIMS THE WARRANTY OF
 * NON INFRINGEMENT OF THIRD PARTY RIGHTS
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
 * or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU Affero General Public License for more details.
 * You should have received a copy of the GNU Affero General Public License
 * along with this program; if not, see http://www.gnu.org/licenses or write to
 * the Free Software Foundation, Inc., 51 Franklin Street, Fifth Floor,
 * Boston, MA, 02110-1301 USA, or download the license from the following URL:
 * https://www.gnu.org/licenses/agpl-3.0.txt
 *
 * The interactive user interfaces in modified source and object code versions
 * of this program must display Appropriate Legal Notices, as required under
 * Section 5 of the GNU Affero General Public License.
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the BigConnect software without
 * disclosing the source code of your own applications.
 *
 * These activities include: offering paid services to customers as an ASP,
 * embedding the product in a web application, shipping BigConnect with a
 * closed source product.
 */
define([
    'react',
    'create-react-class',
    'filepond',
    'filepond-plugin-file-validate-size',
    'filepond-plugin-file-validate-type'
], function(React, createReactClass, filepond, validateSizePlugin, validateTypePlugin)
{
    'use strict';

    const isSupported = filepond.supported();

    filepond.registerPlugin(validateSizePlugin);
    filepond.registerPlugin(validateTypePlugin);

    // returns file sources from the <File/> child objects
    const getFilesFromChildren = children =>
        children ? React.Children.map(
            children,
            child => {
                const props = child.props;

                // new mapping
                if (props.src) {
                    const options = {};
                    if (props.origin) {
                        options.type = props.origin;
                    }
                    if (props.name) {
                        options.file = {
                            name: props.name,
                            size: props.size,
                            type: props.type
                        }
                    }
                    if (props.metadata) {
                        options.metadata = props.metadata;
                    }
                    return {
                        source: props.src,
                        options
                    }
                }

                // deprecated mapping
                if (props.source && props.type) {
                    return {
                        source: props.source,
                        options: {
                            type: props.type
                        }
                    }
                }

                return props.source;
            }
        ) : [];

    // filtered methods
    const filteredMethods = [
        'setOptions',
        'on',
        'off',
        'onOnce',
        'appendTo',
        'insertAfter',
        'insertBefore',
        'isAttachedTo',
        'replaceElement',
        'restoreElement',
        'destroy'
    ];

    const FileUploader = createReactClass({
        componentDidMount() {
            // exit here if not supported
            if (!isSupported) {
                return;
            }

            // Create our pond
            this._pond = filepond.create(this._element, Object.assign({}, this.props, { files: getFilesFromChildren(this.props.children) }));

            // Reference pond methods to FilePond component instance
            Object.keys(this._pond)
                .filter(key => !filteredMethods.includes(key))
                .forEach(key => {
                    this[key] = this._pond[key];
                });
        },

        // Will clean up FilePond instance when unmounted
        componentWillUnmount() {
            // exit when no pond defined
            if (!this._pond) {
                return;
            }

            this._pond.destroy();
        },

        // Something changed
        componentDidUpdate(prevProps) {
            // exit when no pond defined
            if (!this._pond) {
                return;
            }

            const options = Object.assign({}, this.props);

            // test if file list has changed
            const previousFiles = getFilesFromChildren(prevProps.children);
            const currentFiles = getFilesFromChildren(this.props.children);
            if (JSON.stringify(previousFiles) !== JSON.stringify(currentFiles)) {
                options.files = currentFiles;
            }

            this._pond.setOptions(options);
        },


        // Renders basic element hook for FilePond to attach to
        render() {
            const {
                id,
                name,
                className,
                allowMultiple,
                required,
                captureMethod,
                acceptedFileTypes
            } = this.props;
            return React.createElement(
                'div',
                { className: 'filepond--wrapper' },
                React.createElement('input', {
                    type: 'file',
                    name,
                    id,
                    accept: acceptedFileTypes,
                    multiple: allowMultiple,
                    required: required,
                    className: className,
                    capture: captureMethod,
                    ref: element => (this._element = element)
                })
            );
        }
    });

    return FileUploader;
});
