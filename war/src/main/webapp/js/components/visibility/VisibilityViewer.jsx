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
    'create-react-class',
    '../Attacher',
    '../RegistryInjectorHOC'
], function(createReactClass, Attacher, RegistryInjectorHOC) {
    'use strict';

    const DEFAULT_FLIGHT_VIEWER = 'util/visibility/default/view';

    const VisibilityViewer = createReactClass({
        render() {
            const { registry, style, value, ...rest } = this.props;
            const custom = _.first(registry['org.bigconnect.visibility']);

            // Use new react visibility renderer as default if no custom exists
            if (custom && custom.viewerComponentPath !== DEFAULT_FLIGHT_VIEWER) {
                return (
                    <Attacher
                        nodeClassName="visibility"
                        nodeStyle={style}
                        value={value}
                        componentPath={custom.viewerComponentPath}
                        {...rest} />
                );
            }

            return (
                <div className="visibility" style={style}>
                    {_.isUndefined(value) || value === '' ?
                        (<span className={'label label-warning'}>{i18n('visibility.blank')}</span>) :
                        value
                    }
                </div>
            )
        }
    });

    return RegistryInjectorHOC(VisibilityViewer, [
        'org.bigconnect.visibility'
    ]);
});
