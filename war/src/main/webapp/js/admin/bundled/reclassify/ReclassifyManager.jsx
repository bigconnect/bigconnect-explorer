define([
    'flight/lib/component',
    'react',
    'react-dom',
    'create-react-class'
], function(
    defineComponent,
    React,
    ReactDOM,
    createReactClass
) {
    'use strict';

    const CONCEPTS = [
        {id: 'fbPost', name: 'Facebook posts'},
        {id: 'fbComment', name: 'Facebook comments'},
        {id: 'twitterPost', name: 'X posts'},
        {id: 'twitterComment', name: 'X comments'},
        {id: 'instagramPost', name: 'Instagram posts'},
        {id: 'instagramComment', name: 'Instagram comments'},
        {id: 'ttVideo', name: 'TikTok videos'},
        {id: 'youtubeVideo', name: 'YouTube videos'},
        {id: 'webArticle', name: 'Web articles'}
    ];

    const SCOPES = [
        {id: 'MISSING', name: 'Not classified yet', help: 'Posts without a topic. Safe to run any time.'},
        {id: 'NO_CONFIDENT', name: '“No confident classification”', help: 'Posts where the classifier found no topic (or an old API error left this value).'},
        {id: 'ALL', name: 'All matching posts', help: 'Overwrites existing topics. Use after changing the topics or the model.'}
    ];

    const ACTIONS = [
        {id: 'TOPICS', name: 'Topics', help: 'Keeps the relevant keywords/buckets and runs only the topic classification.'},
        {id: 'RELEVANCE_AND_TOPICS', name: 'Relevance + topics', help: 'Recomputes the relevant keywords/buckets first, then the topics.'},
        {id: 'WORKER', name: 'Run a data worker', help: 'Sends the posts to a data worker running in Explorer. The worker itself decides which posts it handles.'}
    ];

    const FACETS = [
        {id: 'buckets', name: 'Buckets'},
        {id: 'keywords', name: 'SERP keywords'},
        {id: 'projects', name: 'Projects'}
    ];

    const LARGE_RUN = 2000;

    const csrfHeaders = () => {
        const user = window.bcData && window.bcData.currentUser;
        return user && user.csrfToken ? {'BC-CSRF-Token': user.csrfToken} : {};
    };

    const formatNumber = n => (n === null || n === undefined) ? '–' : Number(n).toLocaleString();
    const formatTime = ms => ms ? new Date(ms).toLocaleString() : '';

    const FacetList = createReactClass({
        getInitialState() {
            return {search: ''};
        },

        render() {
            const {title, values, selected, loading, onToggle, onSelectMany, onClear} = this.props;
            const search = this.state.search.trim().toLowerCase();
            const visible = (values || []).filter(v => !search || v.value.toLowerCase().indexOf(search) >= 0);
            const selectedSet = new Set(selected);
            // selected values stay listed even when the other filters leave no posts for them
            const missingSelected = selected.filter(s => !(values || []).some(v => v.value === s))
                .map(s => ({value: s, count: 0}));
            const rows = missingSelected.concat(visible);

            return (
                <div className="rc-facet">
                    <div className="rc-facet-header">
                        <strong>{title}</strong>
                        <span className="rc-muted">{selected.length ? `${selected.length} selected` : 'any'}</span>
                    </div>
                    <input
                        className="form-control input-sm"
                        placeholder={`Search ${title.toLowerCase()}…`}
                        value={this.state.search}
                        onChange={e => this.setState({search: e.target.value})}
                    />
                    <div className="rc-facet-actions">
                        <a onClick={() => onSelectMany(visible.map(v => v.value))}>Select {search ? 'shown' : 'all'}</a>
                        {selected.length > 0 && <a onClick={onClear}>Clear</a>}
                    </div>
                    <div className={`rc-facet-list ${loading ? 'rc-loading' : ''}`}>
                        {rows.length === 0 && <div className="rc-muted rc-empty">{loading ? 'Loading…' : 'No values'}</div>}
                        {rows.map(v => (
                            <label key={v.value} className={`rc-facet-row ${selectedSet.has(v.value) ? 'rc-selected' : ''}`}>
                                <input
                                    type="checkbox"
                                    checked={selectedSet.has(v.value)}
                                    onChange={() => onToggle(v.value)}
                                />
                                <span className="rc-facet-value" title={v.value}>{v.value}</span>
                                <span className="rc-count">{formatNumber(v.count)}</span>
                            </label>
                        ))}
                    </div>
                </div>
            );
        }
    });

    const ReclassifyComponent = createReactClass({
        getInitialState() {
            return {
                concepts: CONCEPTS.map(c => c.id),
                keywords: [],
                buckets: [],
                projects: [],
                from: '',
                to: '',
                scope: 'MISSING',
                action: 'TOPICS',
                worker: '',
                workers: [],
                workersError: '',
                priority: 'LOW',
                limit: '',
                facets: {keywords: [], buckets: [], projects: []},
                facetsLoading: false,
                preview: null,
                previewLoading: false,
                error: '',
                confirming: false,
                starting: false,
                jobs: []
            };
        },

        componentDidMount() {
            this.mounted = true;
            this.refresh();
            this.loadJobs();
            this.loadWorkers();
        },

        loadWorkers() {
            $.ajax({url: 'admin/reclassify/workers'})
                .then(result => {
                    if (!this.mounted) return;
                    const workers = (result.workers || []).slice().sort((a, b) => a.name.localeCompare(b.name));
                    this.setState({workers, workersError: workers.length ? '' : 'No data workers are running in this Explorer.'});
                })
                .catch(err => {
                    console.error('Could not load the data workers', err);
                    if (this.mounted) this.setState({workersError: 'Could not load the data workers.'});
                });
        },

        workerName(className) {
            const worker = this.state.workers.find(w => w.className === className);
            return worker ? worker.name : (className || '').split('.').pop();
        },

        componentWillUnmount() {
            this.mounted = false;
            clearTimeout(this.refreshTimer);
            clearTimeout(this.jobsTimer);
        },

        filterParams() {
            const {concepts, keywords, buckets, projects, from, to, scope, action, worker} = this.state;
            const params = {concepts, keywords, buckets, projects, from, to, scope, action};
            if (action === 'WORKER') params.worker = worker;
            return params;
        },

        update(changes) {
            this.setState(Object.assign({confirming: false}, changes), () => {
                clearTimeout(this.refreshTimer);
                this.refreshTimer = setTimeout(this.refresh, 400);
            });
        },

        refresh() {
            if (!this.state.concepts.length) {
                this.setState({preview: {toClassify: 0}, facets: {keywords: [], buckets: [], projects: []}});
                return;
            }
            const params = this.filterParams();
            const requestId = (this.requestId || 0) + 1;
            this.requestId = requestId;
            const workerMissing = params.action === 'WORKER' && !params.worker;
            this.setState({facetsLoading: true, previewLoading: !workerMissing, error: ''});
            if (workerMissing) {
                this.setState({preview: null});
            }

            $.ajax({url: 'admin/reclassify/facets', data: params})
                .then(facets => {
                    if (this.mounted && requestId === this.requestId) {
                        this.setState({facets, facetsLoading: false});
                    }
                })
                .catch(err => this.fail('Could not load the keyword counts', err));

            if (workerMissing) return;
            $.ajax({url: 'admin/reclassify/preview', data: params})
                .then(preview => {
                    if (this.mounted && requestId === this.requestId) {
                        this.setState({preview, previewLoading: false});
                    }
                })
                .catch(err => this.fail('Could not count the matching posts', err));
        },

        fail(message, err) {
            console.error(message, err);
            if (this.mounted) {
                const detail = err && err.responseJSON && err.responseJSON.message;
                this.setState({error: detail ? `${message}: ${detail}` : message, facetsLoading: false, previewLoading: false, starting: false});
            }
        },

        loadJobs() {
            clearTimeout(this.jobsTimer);
            $.ajax({url: 'admin/reclassify/jobs'})
                .then(result => {
                    if (!this.mounted) return;
                    this.setState({jobs: result.jobs || []});
                    const active = (result.jobs || []).some(j => ['RUNNING', 'PROCESSING', 'STALLED'].indexOf(j.state) >= 0);
                    this.jobsTimer = setTimeout(this.loadJobs, active ? 5000 : 15000);
                })
                .catch(err => {
                    console.error('Could not load reclassify jobs', err);
                    if (this.mounted) this.jobsTimer = setTimeout(this.loadJobs, 15000);
                });
        },

        toggleIn(field, value) {
            const current = this.state[field];
            this.update({[field]: current.indexOf(value) >= 0 ? current.filter(v => v !== value) : current.concat([value])});
        },

        selectMany(field, values) {
            const merged = this.state[field].slice();
            values.forEach(v => { if (merged.indexOf(v) < 0) merged.push(v); });
            this.update({[field]: merged});
        },

        postsToRun() {
            const {preview, limit} = this.state;
            if (!preview) return null;
            const max = parseInt(limit, 10);
            const available = preview.toClassify !== undefined ? preview.toClassify : preview.matching;
            return max > 0 ? Math.min(max, available) : available;
        },

        onStart() {
            const toRun = this.postsToRun();
            const needsConfirm = (this.state.action !== 'WORKER' && this.state.scope === 'ALL') || toRun > LARGE_RUN;
            if (needsConfirm && !this.state.confirming) {
                this.setState({confirming: true});
                return;
            }
            const max = parseInt(this.state.limit, 10);
            const data = Object.assign(this.filterParams(), {
                priority: this.state.priority
            }, max > 0 ? {limit: max} : {});

            this.setState({starting: true, confirming: false, error: ''});
            $.ajax({url: 'admin/reclassify/start', method: 'POST', data, headers: csrfHeaders()})
                .then(() => {
                    if (!this.mounted) return;
                    this.setState({starting: false});
                    this.loadJobs();
                })
                .catch(err => this.fail('Could not start the run', err));
        },

        onCancel(id) {
            $.ajax({url: 'admin/reclassify/cancel', method: 'POST', data: {id}, headers: csrfHeaders()})
                .then(this.loadJobs)
                .catch(err => this.fail('Could not stop the job', err));
        },

        describeFilter(filter) {
            const parts = [];
            const all = filter.concepts.length === CONCEPTS.length;
            parts.push(all ? 'all types' : filter.concepts.map(id => (CONCEPTS.find(c => c.id === id) || {name: id}).name).join(', '));
            if (filter.buckets.length) parts.push(`buckets: ${filter.buckets.join(', ')}`);
            if (filter.keywords.length) parts.push(`keywords: ${filter.keywords.join(', ')}`);
            if (filter.projects.length) parts.push(`projects: ${filter.projects.join(', ')}`);
            if (filter.from || filter.to) parts.push(`modified ${filter.from ? new Date(filter.from).toISOString().slice(0, 10) : '…'} → ${filter.to ? new Date(filter.to - 1).toISOString().slice(0, 10) : '…'}`);
            if (filter.scope && !filter.worker) parts.push((SCOPES.find(s => s.id === filter.scope) || {name: filter.scope}).name.toLowerCase());
            return parts.join(' · ');
        },

        renderWorkerPreview(preview) {
            const share = preview.sample ? Math.round(100 * preview.handledInSample / preview.sample) : 0;
            return (
                <div className="rc-worker-preview">
                    <div>
                        Checked on {formatNumber(preview.sample)} of the matching posts: the worker handles <b>{formatNumber(preview.handledInSample)}</b> ({share}%).
                        {preview.handledInSample === 0 && preview.sample > 0 && <span className="text-warning"> It will skip them, e.g. because it already processed them or they miss what it needs.</span>}
                    </div>
                    {preview.properties.length > 0 && (
                        <table className="table table-condensed rc-worker-table">
                            <thead><tr><th>Re-queued property</th><th>Posts in sample</th><th>Also starts</th></tr></thead>
                            <tbody>{preview.properties.map(p => (
                                <tr key={p.property}>
                                    <td><code>{p.property}</code></td>
                                    <td>{formatNumber(p.posts)}</td>
                                    <td>{p.alsoStarts.length ? p.alsoStarts.join(', ') : <span className="rc-muted">no other worker</span>}</td>
                                </tr>
                            ))}</tbody>
                        </table>
                    )}
                </div>
            );
        },

        renderJobs() {
            const {jobs} = this.state;
            if (!jobs.length) {
                return <div className="rc-muted">No runs since Explorer started.</div>;
            }
            return jobs.map(job => {
                const sending = job.state === 'RUNNING';
                // while sending the bar shows the posts checked; afterwards the posts the data workers finished
                const pct = sending
                    ? (job.total ? Math.round(100 * job.processed / job.total) : 0)
                    : (job.requeued ? Math.round(100 * job.done / job.requeued) : 100);
                const stateClass = {RUNNING: 'info', PROCESSING: 'primary', DONE: 'success', STALLED: 'warning', FAILED: 'danger', CANCELLED: 'default'}[job.state] || 'default';
                const stateLabel = {RUNNING: 'SENDING', PROCESSING: 'PROCESSING'}[job.state] || job.state;
                const tracking = job.state === 'PROCESSING' || job.state === 'STALLED';
                return (
                    <div className="rc-job" key={job.id}>
                        <div className="rc-job-head">
                            <span className={`label label-${stateClass}`}>{stateLabel}</span>
                            <strong>{job.action === 'WORKER' ? this.workerName(job.worker) : (ACTIONS.find(a => a.id === job.action) || {name: job.action}).name}</strong>
                            <span className="rc-muted">{formatTime(job.startedAt)}</span>
                            {sending && !job.total && <span className="rc-muted">finding posts…</span>}
                            {sending && (
                                <button className="btn btn-xs btn-default rc-right" onClick={() => this.onCancel(job.id)}>Stop</button>
                            )}
                            {tracking && (
                                <button className="btn btn-xs btn-default rc-right" title="Posts already sent are still processed"
                                        onClick={() => this.onCancel(job.id)}>Stop tracking</button>
                            )}
                        </div>
                        <div className="rc-muted rc-job-filter">{this.describeFilter(Object.assign({}, job.filter, {worker: job.worker}))}</div>
                        <div className="progress rc-progress">
                            <div className={`progress-bar ${sending || tracking ? 'progress-bar-striped active' : ''} ${job.state === 'STALLED' ? 'progress-bar-warning' : ''}`} style={{width: `${pct}%`}} />
                        </div>
                        <div className="rc-job-stats">
                            {!sending && <span><b>{formatNumber(job.done)}</b> / {formatNumber(job.requeued)} done ({pct}%)</span>}
                            {!sending && job.waiting > 0 && <span>{formatNumber(job.waiting)} waiting in the queue</span>}
                            {!sending && job.lastProgressAt && tracking && <span className="rc-muted">last finished {formatTime(job.lastProgressAt)}</span>}
                            {job.doneWithoutKeywords > 0 && <span title="The recomputed relevance found no keywords, so no topic is classified">{formatNumber(job.doneWithoutKeywords)} without relevant keywords</span>}
                            <span>{formatNumber(job.requeued)} sent to {job.action === 'WORKER' ? 'the worker' : 'classification'}</span>
                            {sending && <span>{formatNumber(job.processed)} / {formatNumber(job.total)} checked</span>}
                            {job.skippedNoLanguage > 0 && <span title="The classifiers need a detected language">{formatNumber(job.skippedNoLanguage)} without language</span>}
                            {job.skippedAlreadyClassified > 0 && <span title="Classified between the search and the run">{formatNumber(job.skippedAlreadyClassified)} already classified</span>}
                            {job.skippedNotHandled > 0 && <span title="The worker does not handle these posts, e.g. it already processed them">{formatNumber(job.skippedNotHandled)} not handled by the worker</span>}
                            {job.errors > 0 && <span className="text-danger">{formatNumber(job.errors)} errors</span>}
                            {job.message && <span className={job.state === 'DONE' ? 'rc-muted' : 'text-danger'}>{job.message}</span>}
                        </div>
                    </div>
                );
            });
        },

        render() {
            const s = this.state;
            const toRun = this.postsToRun();
            const running = s.jobs.some(j => j.state === 'RUNNING');
            const isWorker = s.action === 'WORKER';
            const canStart = !s.starting && !s.previewLoading && toRun > 0 && s.concepts.length > 0 && (!isWorker || s.worker);
            const allConcepts = s.concepts.length === CONCEPTS.length;

            return (
                <div className="rc-container">
                    <h2>Reprocess posts</h2>
                    <p className="rc-muted">
                        Choose the posts, then send them back to the relevance and topic classification, or to any data
                        worker running in Explorer. For the classification, all counts are posts that will really be
                        classified: posts without a detected language, and for “Topics” posts without relevant keywords,
                        are left out.
                    </p>

                    <div className="rc-section">
                        <div className="rc-step">1</div>
                        <div className="rc-section-body">
                            <h4>Which posts</h4>

                            <div className="rc-row">
                                <label className="rc-label">Types</label>
                                <div className="rc-chips">
                                    <button
                                        className={`btn btn-xs ${allConcepts ? 'btn-primary' : 'btn-default'}`}
                                        onClick={() => this.update({concepts: allConcepts ? [] : CONCEPTS.map(c => c.id)})}
                                    >All</button>
                                    {CONCEPTS.map(c => (
                                        <button
                                            key={c.id}
                                            className={`btn btn-xs ${s.concepts.indexOf(c.id) >= 0 ? 'btn-info' : 'btn-default'}`}
                                            onClick={() => this.toggleIn('concepts', c.id)}
                                        >{c.name}</button>
                                    ))}
                                </div>
                            </div>

                            <div className="rc-facets">
                                {FACETS.map(f => (
                                    <FacetList
                                        key={f.id}
                                        title={f.name}
                                        values={s.facets[f.id]}
                                        selected={s[f.id]}
                                        loading={s.facetsLoading}
                                        onToggle={value => this.toggleIn(f.id, value)}
                                        onSelectMany={values => this.selectMany(f.id, values)}
                                        onClear={() => this.update({[f.id]: []})}
                                    />
                                ))}
                            </div>

                            <div className="rc-row">
                                <label className="rc-label">Modified</label>
                                <input type="date" className="form-control input-sm rc-date" value={s.from}
                                       onChange={e => this.update({from: e.target.value})} />
                                <span className="rc-muted">to</span>
                                <input type="date" className="form-control input-sm rc-date" value={s.to}
                                       onChange={e => this.update({to: e.target.value})} />
                                {(s.from || s.to) && <a onClick={() => this.update({from: '', to: ''})}>any date</a>}
                            </div>

                            {!isWorker && <div className="rc-row rc-row-top">
                                <label className="rc-label">Status</label>
                                <div className="rc-options">
                                    {SCOPES.map(o => (
                                        <label key={o.id} className={`rc-option ${s.scope === o.id ? 'rc-option-on' : ''}`}>
                                            <input type="radio" name="rc-scope" checked={s.scope === o.id}
                                                   onChange={() => this.update({scope: o.id})} />
                                            <span><b>{o.name}</b><br /><span className="rc-muted">{o.help}</span></span>
                                        </label>
                                    ))}
                                </div>
                            </div>}
                        </div>
                    </div>

                    <div className="rc-section">
                        <div className="rc-step">2</div>
                        <div className="rc-section-body">
                            <h4>What to run</h4>
                            <div className="rc-row rc-row-top">
                                <label className="rc-label">Run</label>
                                <div className="rc-options">
                                    {ACTIONS.map(o => (
                                        <label key={o.id} className={`rc-option ${s.action === o.id ? 'rc-option-on' : ''}`}>
                                            <input type="radio" name="rc-action" checked={s.action === o.id}
                                                   onChange={() => this.update({action: o.id})} />
                                            <span><b>{o.name}</b><br /><span className="rc-muted">{o.help}</span></span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            {isWorker && <div className="rc-row">
                                <label className="rc-label">Data worker</label>
                                <select className="form-control input-sm rc-worker" value={s.worker}
                                        onChange={e => this.update({worker: e.target.value})}>
                                    <option value="">Choose a data worker…</option>
                                    {s.workers.map(w => (
                                        <option key={w.className} value={w.className} title={w.description}>{w.name}</option>
                                    ))}
                                </select>
                                {s.worker && <span className="rc-muted rc-worker-help">{(s.workers.find(w => w.className === s.worker) || {}).description}</span>}
                                {s.workersError && <span className="text-danger">{s.workersError}</span>}
                            </div>}
                            {isWorker && s.preview && s.preview.properties && this.renderWorkerPreview(s.preview)}
                            <div className="rc-row">
                                <label className="rc-label">Priority</label>
                                <select className="form-control input-sm rc-small" value={s.priority}
                                        onChange={e => this.setState({priority: e.target.value})}>
                                    <option value="LOW">Low (after new posts)</option>
                                    <option value="NORMAL">Normal</option>
                                    <option value="HIGH">High (before new posts)</option>
                                </select>
                                <label className="rc-label rc-label-inline">At most</label>
                                <input type="number" min="1" className="form-control input-sm rc-small" placeholder="all posts"
                                       value={s.limit} onChange={e => this.setState({limit: e.target.value, confirming: false})} />
                                <span className="rc-muted">posts (try a small batch first)</span>
                            </div>
                        </div>
                    </div>

                    <div className="rc-summary">
                        <div className="rc-summary-text">
                            {isWorker && !s.worker ? <span className="rc-muted">Choose a data worker</span>
                                : s.previewLoading || !s.preview ? <span className="rc-muted">Counting posts…</span>
                                : isWorker ? <span><b className="rc-big">{formatNumber(toRun)}</b> posts will be checked by {this.workerName(s.worker)}</span>
                                : <span><b className="rc-big">{formatNumber(toRun)}</b> posts will be classified</span>}
                        </div>
                        {s.confirming && (
                            <span className="rc-confirm">
                                {s.scope === 'ALL' ? 'Existing topics will be overwritten. ' : ''}Send {formatNumber(toRun)} posts?
                            </span>
                        )}
                        {s.confirming && <button className="btn btn-default" onClick={() => this.setState({confirming: false})}>Back</button>}
                        <button className={`btn ${s.confirming ? 'btn-danger' : 'btn-primary'}`} disabled={!canStart} onClick={this.onStart}>
                            {s.starting ? 'Starting…' : s.confirming ? 'Yes, start' : isWorker ? 'Start worker' : 'Start reclassification'}
                        </button>
                    </div>
                    {running && <div className="rc-muted rc-note">A run is sending posts; a new one starts after it.</div>}
                    {s.error && <div className="alert alert-danger rc-error">{s.error}</div>}

                    <div className="rc-section">
                        <div className="rc-step">3</div>
                        <div className="rc-section-body">
                            <h4>Runs <a className="rc-refresh" onClick={this.loadJobs}>refresh</a></h4>
                            {this.renderJobs()}
                        </div>
                    </div>

                    <style>{`
                        .rc-container { padding: 20px; max-width: 1100px; }
                        .rc-muted { color: #888; }
                        .rc-section { display: flex; margin-top: 18px; border-top: 1px solid #e5e5e5; padding-top: 14px; }
                        .rc-step { flex: 0 0 26px; height: 26px; border-radius: 13px; background: #337ab7; color: #fff; text-align: center; line-height: 26px; font-weight: bold; margin-right: 12px; }
                        .rc-section-body { flex: 1; min-width: 0; }
                        .rc-section-body h4 { margin-top: 3px; }
                        .rc-row { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin: 10px 0; }
                        .rc-row-top { align-items: flex-start; }
                        .rc-label { flex: 0 0 110px; margin: 0; font-weight: 600; }
                        .rc-label-inline { flex: 0 0 auto; margin-left: 16px; }
                        .rc-chips { display: flex; flex-wrap: wrap; gap: 4px; flex: 1; }
                        .rc-facets { display: flex; gap: 12px; margin: 12px 0; flex-wrap: wrap; }
                        .rc-facet { flex: 1 1 300px; min-width: 0; border: 1px solid #ddd; border-radius: 4px; padding: 8px; }
                        .rc-facet-header { display: flex; justify-content: space-between; margin-bottom: 6px; }
                        .rc-facet-actions { display: flex; gap: 12px; font-size: 12px; margin: 4px 0; }
                        .rc-facet-actions a, .rc-row a, .rc-refresh { cursor: pointer; }
                        .rc-refresh { font-size: 12px; font-weight: normal; margin-left: 8px; }
                        .rc-facet-list { max-height: 220px; overflow-y: auto; }
                        .rc-loading { opacity: 0.5; }
                        .rc-empty { padding: 6px; }
                        .rc-facet-row { display: flex; align-items: center; gap: 6px; font-weight: normal; margin: 0; padding: 2px 4px; border-radius: 3px; cursor: pointer; }
                        .rc-facet-row:hover { background: #f5f5f5; }
                        .rc-selected { background: #eaf3fb; }
                        .rc-facet-value { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                        .rc-count { color: #888; font-size: 12px; }
                        .rc-date { width: 150px; }
                        .rc-small { width: 190px; }
                        .rc-options { display: flex; gap: 8px; flex-wrap: wrap; flex: 1; }
                        .rc-option { flex: 1 1 220px; display: flex; gap: 8px; align-items: flex-start; font-weight: normal; border: 1px solid #ddd; border-radius: 4px; padding: 8px; margin: 0; cursor: pointer; }
                        .rc-option-on { border-color: #337ab7; background: #f3f8fc; }
                        .rc-option input { margin-top: 3px; }
                        .rc-summary { position: sticky; bottom: 0; display: flex; align-items: center; gap: 10px; margin-top: 18px; padding: 12px; background: #fff; border: 1px solid #ddd; border-radius: 4px; box-shadow: 0 -2px 6px rgba(0,0,0,0.05); z-index: 2; }
                        .rc-summary-text { flex: 1; }
                        .rc-big { font-size: 20px; }
                        .rc-confirm { color: #a94442; font-weight: 600; }
                        .rc-note { margin-top: 6px; }
                        .rc-error { margin-top: 10px; }
                        .rc-job { border: 1px solid #e5e5e5; border-radius: 4px; padding: 8px 10px; margin-bottom: 8px; }
                        .rc-job-head { display: flex; align-items: center; gap: 8px; }
                        .rc-right { margin-left: auto; }
                        .rc-job-filter { font-size: 12px; margin: 4px 0; }
                        .rc-progress { height: 8px; margin: 6px 0; }
                        .rc-job-stats { display: flex; flex-wrap: wrap; gap: 14px; font-size: 12px; }
                        .rc-worker { width: 320px; }
                        .rc-worker-help { flex: 1; min-width: 200px; }
                        .rc-worker-preview { margin: 6px 0 10px 118px; font-size: 13px; }
                        .rc-worker-table { margin-top: 6px; max-width: 760px; }
                    `}</style>
                </div>
            );
        }
    });

    return defineComponent(ReclassifyManager);

    function ReclassifyManager() {
        this.after('initialize', function() {
            ReactDOM.render(React.createElement(ReclassifyComponent), this.node);
            this.on('teardown', function() {
                ReactDOM.unmountComponentAtNode(this.node);
            });
        });
    }
});
